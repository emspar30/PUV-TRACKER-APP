import { useCallback, useEffect, useState } from 'react';

import { evidenceHint, type FlaggedPost, type PendingAppeal, type Suspension } from '@/shared/moderation/console';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { errorText } from './errors';
import { Icon } from './Icon';
import { PageHeader } from './PageHeader';

const text = strings.adminConsole;
const t = text.moderation;
const feed = strings.crowdsource;

type Lists = { flagged: FlaggedPost[]; appeals: PendingAppeal[]; suspensions: Suspension[] };

const phraseOf = (phrase: string | null) => (phrase && phrase in feed.phrases ? feed.phrases[phrase as keyof typeof feed.phrases] : t.noPhrase);
const tagOf = (tag: string) => (tag in feed.flagTags ? feed.flagTags[tag as keyof typeof feed.flagTags] : tag);

// Moderation (owner, 2026-11-23): the rules run by themselves (migration
// 20261123000000_auto_moderation.sql). The admin decides flagged verified rides (the evidence
// conflicts) and appeals, and may lift a suspension or ban to fix a mistake. Suspensions and bans come
// only from the rules (owner, 2026-11-23). Every action goes into Admin activity.
// onChanged: the console's count of what waits here
export function Moderation({ api, onChanged }: { api: ConsoleApi; onChanged: () => void }) {
  const [lists, setLists] = useState<Lists | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [flagged, appeals, suspensions] = await Promise.all([api.flaggedPosts(), api.appeals(), api.suspensions()]);
    if (flagged.ok && appeals.ok && suspensions.ok) {
      setLists({ flagged: flagged.value, appeals: appeals.value, suspensions: suspensions.value });
      setUpdatedAt(Date.now());
      setError(null);
    } else {
      setError(!flagged.ok ? flagged.error : !appeals.ok ? appeals.error : !suspensions.ok ? suspensions.error : null);
    }
  }, [api]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    return () => clearTimeout(first);
  }, [load]);

  // Runs one action, then reloads the lists and the tab's count
  async function act(ask: string | null, run: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    if (ask !== null && !window.confirm(ask)) return;
    setBusy(true);
    setDone(null);
    setError(null);
    const result = await run();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(success);
    onChanged();
    await load();
  }

  return (
    <>
      {done && (
        <div className="notice ok banner" role="status">
          <Icon name="checkCircle" />
          <span>{done}</span>
          <button type="button" className="icon-button" aria-label={text.drivers.dismiss} onClick={() => setDone(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <PageHeader title={t.title} subtitle={t.subtitle} updatedAt={updatedAt} onRefresh={() => void load()} />
      {error && (
        <p className="notice error" role="alert">
          <Icon name="error" />
          {errorText(error)}
        </p>
      )}

      <details className="card form-card rules-card">
        <summary>{t.rulesHeading}</summary>
        <ul className="rules-list">
          {t.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>

      {lists && (
        <>
          <section className="card form-card" aria-labelledby="flagged-heading">
            <div>
              <h2 id="flagged-heading">{t.flaggedHeading}</h2>
            </div>
            {lists.flagged.length === 0 ? (
              <p className="muted">{t.flaggedEmpty}</p>
            ) : (
              <ul className="mod-list">
                {lists.flagged.map((post) => (
                  <FlaggedItem
                    key={post.post_id}
                    post={post}
                    busy={busy}
                    onConfirm={() => void act(t.confirmAsk(post.author), () => api.confirmReport(post.post_id), t.confirmed)}
                    onDismiss={() => void act(t.dismissAsk, () => api.dismissReport(post.post_id), t.dismissed)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="card form-card" aria-labelledby="appeals-heading">
            <div>
              <h2 id="appeals-heading">{t.appealsHeading}</h2>
            </div>
            {lists.appeals.length === 0 ? (
              <p className="muted">{t.appealsEmpty}</p>
            ) : (
              <ul className="mod-list">
                {lists.appeals.map((appeal) => (
                  <li key={appeal.appeal_id} className="mod-item">
                    <p>
                      <strong>{t.appealFrom(appeal.account, text.when(appeal.appealed_at))}</strong>
                    </p>
                    <p className="muted small">
                      {t.strikeFor(t.strikeReasons[appeal.strike_reason] ?? appeal.strike_reason, text.when(appeal.struck_at))}
                      {appeal.route_id ? ` · ${t.post(appeal.route_id, phraseOf(appeal.phrase))}` : ''}
                    </p>
                    {appeal.verified !== null && (
                      <p className="muted small">
                        {t.verified(appeal.verified === true)} · {t.beacon(appeal.beacon_ok)} · {t.flags(appeal.flags, appeal.flags)}
                      </p>
                    )}
                    <blockquote className="appeal-body">{appeal.body}</blockquote>
                    <div className="actions">
                      <button type="button" className="button primary" disabled={busy} onClick={() => void act(null, () => api.decideAppeal(appeal.appeal_id, true), t.upheld)}>
                        {t.uphold}
                      </button>
                      <button type="button" className="button secondary" disabled={busy} onClick={() => void act(null, () => api.decideAppeal(appeal.appeal_id, false), t.denied)}>
                        {t.deny}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card form-card" aria-labelledby="suspended-heading">
            <div>
              <h2 id="suspended-heading">{t.suspendedHeading}</h2>
            </div>
            {lists.suspensions.length === 0 ? (
              <p className="muted">{t.suspendedEmpty}</p>
            ) : (
              <ul className="mod-list">
                {lists.suspensions.map((row) => (
                  <li key={row.account_id} className="mod-item mod-row">
                    <span>
                      <strong>{row.account}</strong>{' '}
                      <span className={`status ${row.banned ? 'danger' : 'warning'}`}>{row.banned ? t.banned : t.until(text.whenFull(row.suspended_until))}</span>
                      <span className="muted small plate-partners">
                        {row.by_rules ? t.byRules : t.byHand} · {t.times(row.suspensions)} · {t.strikes(row.strikes_now)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() => void act(t.liftAsk(row.account), () => api.lift(row.account_id), t.lifted)}>
                      {t.lift}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </>
      )}
    </>
  );
}

function FlaggedItem({ post, busy, onConfirm, onDismiss }: { post: FlaggedPost; busy: boolean; onConfirm: () => void; onDismiss: () => void }) {
  const hint = evidenceHint(post);
  return (
    <li className={`mod-item${post.needs_review ? ' needs-you' : ''}`}>
      <p className="mod-head">
        <strong>{t.post(post.route_id, phraseOf(post.phrase))}</strong>
        {post.needs_review && <span className="status primary">{t.needsYou}</span>}
        <span className={`status ${post.hidden ? 'danger' : 'muted'}`}>{post.hidden ? t.hiddenBadge : t.shownBadge}</span>
        {post.struck && <span className="status warning">{t.struckBadge}</span>}
        {post.live_map && <span className="status muted">{t.liveMap}</span>}
      </p>
      <p className="muted small">{t.by(post.author, text.when(post.posted_at))}</p>
      <div className="evidence">
        <p className="small">
          <strong>{t.evidence}:</strong> {t.verified(post.verified)} · {t.beacon(post.beacon_ok)} · {t.gps(post.with_gps)} · {t.risk(post.risk_events)}
        </p>
        <p className="small">
          {t.flags(post.weighted_flags, post.flags)}
          {post.tags.length > 0 ? ` · ${post.tags.map(tagOf).join(', ')}` : ''} · {t.strikes(post.author_strikes)}
          {post.author_suspended_until ? ` · ${t.authorSuspended(text.whenFull(post.author_suspended_until))}` : ''}
        </p>
        {post.notes.length > 0 && (
          <div className="small">
            <span className="muted">{t.notes}:</span>
            <ul className="notes-list">
              {post.notes.map((note, index) => (
                <li key={`${post.post_id}-${index}`}>“{note}”</li>
              ))}
            </ul>
          </div>
        )}
        <p className={`small hint ${hint}`}>
          <Icon name={hint === 'likely_real' ? 'checkCircle' : hint === 'likely_false' ? 'warning' : 'info'} size={14} /> {t.hints[hint]}
        </p>
      </div>
      <div className="actions">
        {!post.struck && (
          <button type="button" className="button danger-soft" disabled={busy} onClick={onConfirm}>
            {t.confirm}
          </button>
        )}
        <button type="button" className="button secondary" disabled={busy} onClick={onDismiss}>
          {t.dismiss}
        </button>
      </div>
    </li>
  );
}

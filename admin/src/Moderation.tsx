import { useCallback, useEffect, useRef, useState } from 'react';

import { evidenceHint, type FlaggedPost, type PendingAppeal, type Suspension } from '@/shared/moderation/console';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { askConfirm, type ConfirmRequest } from './confirm';
import { errorText } from './errors';
import { Icon, type IconName } from './Icon';
import { PageHeader } from './PageHeader';

const text = strings.adminConsole;
const t = text.moderation;
const feed = strings.crowdsource;

type Lists = { flagged: FlaggedPost[]; appeals: PendingAppeal[]; suspensions: Suspension[] };
const TABS = ['flagged', 'appeals', 'suspended'] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, IconName> = { flagged: 'warning', appeals: 'send', suspended: 'block' };
type Viewing = { kind: 'report'; post: FlaggedPost } | { kind: 'appeal'; appeal: PendingAppeal } | null;

const phraseOf = (phrase: string | null) => (phrase && phrase in feed.phrases ? feed.phrases[phrase as keyof typeof feed.phrases] : t.noPhrase);
const tagOf = (tag: string) => (tag in feed.flagTags ? feed.flagTags[tag as keyof typeof feed.flagTags] : tag);

// Moderation (owner, 2026-11-23): the rules run by themselves (migration
// 20261123000000_auto_moderation.sql). The admin decides flagged verified rides (the evidence
// conflicts) and appeals, and may lift a suspension or ban to fix a mistake. Suspensions and bans come
// only from the rules. Laid out like Drivers (2026-11-23): a tab per list with its count, a table, and
// View for one report's or appeal's evidence. Every action goes into Admin activity.
// onChanged: the console's count of what waits here
export function Moderation({ api, onChanged }: { api: ConsoleApi; onChanged: () => void }) {
  const [lists, setLists] = useState<Lists | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('flagged');
  const [viewing, setViewing] = useState<Viewing>(null);

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
  async function act(ask: ConfirmRequest | null, run: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    setViewing(null);
    if (ask !== null && !(await askConfirm(ask))) return;
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

  const confirmReport = (post: FlaggedPost) =>
    void act({ title: t.confirm, body: t.confirmAsk(post.author), confirmLabel: t.confirm, danger: true }, () => api.confirmReport(post.post_id), t.confirmed);
  const dismissReport = (post: FlaggedPost) => void act({ title: t.dismiss, body: t.dismissAsk, confirmLabel: t.dismiss }, () => api.dismissReport(post.post_id), t.dismissed);
  const decideAppeal = (appeal: PendingAppeal, upheld: boolean) => void act(null, () => api.decideAppeal(appeal.appeal_id, upheld), upheld ? t.upheld : t.denied);

  const counts: Record<Tab, number> = {
    flagged: lists?.flagged.length ?? 0,
    appeals: lists?.appeals.length ?? 0,
    suspended: lists?.suspensions.length ?? 0,
  };

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

      <details className="card rules-card">
        <summary>
          <Icon name="info" size={16} />
          {t.rulesHeading}
        </summary>
        <ul className="rules-list">
          {t.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>

      <div className="segmented" role="tablist" aria-label={t.tabsLabel}>
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`moderation-tab-${name}`}
            aria-selected={tab === name}
            aria-controls="moderation-panel"
            className="segment"
            onClick={() => setTab(name)}>
            {t.tabs[name]}
            <span className="segment-count">{counts[name]}</span>
          </button>
        ))}
      </div>

      <div id="moderation-panel" role="tabpanel" aria-labelledby={`moderation-tab-${tab}`} className="card table-card">
        <div className="table-toolbar">
          <span className="toolbar-icon">
            <Icon name={TAB_ICONS[tab]} />
          </span>
          <div className="toolbar-text">
            <h2>{t.tabs[tab]}</h2>
            <p className="muted small">{t.tabBodies[tab]}</p>
          </div>
        </div>

        {!lists ? (
          !error && <p className="no-match muted">{t.loading}</p>
        ) : counts[tab] === 0 ? (
          <div className="empty-state inline">
            <span className="empty-icon">
              <Icon name={TAB_ICONS[tab]} size={22} />
            </span>
            <h3>{t.emptyHeadings[tab]}</h3>
            <p className="muted">{t.emptyBodies[tab]}</p>
          </div>
        ) : tab === 'flagged' ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.columns.status}</th>
                  <th scope="col">{t.columns.report}</th>
                  <th scope="col">{t.columns.author}</th>
                  <th scope="col">{t.columns.posted}</th>
                  <th scope="col">{t.columns.flags}</th>
                  <th scope="col">{t.columns.evidence}</th>
                  <td />
                </tr>
              </thead>
              <tbody>
                {lists.flagged.map((post) => {
                  const hint = evidenceHint(post);
                  return (
                    <tr key={post.post_id} className={post.needs_review ? 'row-needs-you' : undefined}>
                      <td className="nowrap">
                        <ReportStatus post={post} />
                      </td>
                      <td>
                        <span className="chip-code">{post.route_id}</span> {phraseOf(post.phrase)}
                      </td>
                      <td className="nowrap">{post.author}</td>
                      <td className="nowrap muted">{text.when(post.posted_at)}</td>
                      <td className="nowrap">{t.flagsShort(post.weighted_flags, post.flags)}</td>
                      <td className={`nowrap hint-cell ${hint}`}>
                        <Icon name={hint === 'likely_real' ? 'checkCircle' : hint === 'likely_false' ? 'warning' : 'info'} size={14} />
                        {t.hintsShort[hint]}
                      </td>
                      <td className="end">
                        <button type="button" className="button secondary" aria-label={t.viewReportLabel(post.author)} onClick={() => setViewing({ kind: 'report', post })}>
                          <Icon name="eye" size={16} />
                          {t.view}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : tab === 'appeals' ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.columns.account}</th>
                  <th scope="col">{t.columns.strike}</th>
                  <th scope="col">{t.columns.appealed}</th>
                  <td />
                </tr>
              </thead>
              <tbody>
                {lists.appeals.map((appeal) => (
                  <tr key={appeal.appeal_id}>
                    <td className="nowrap">{appeal.account}</td>
                    <td>{t.strikeReasons[appeal.strike_reason] ?? appeal.strike_reason}</td>
                    <td className="nowrap muted">{text.when(appeal.appealed_at)}</td>
                    <td className="end">
                      <button type="button" className="button secondary" aria-label={t.viewAppealLabel(appeal.account)} onClick={() => setViewing({ kind: 'appeal', appeal })}>
                        <Icon name="eye" size={16} />
                        {t.view}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.columns.account}</th>
                  <th scope="col">{t.columns.status}</th>
                  <th scope="col">{t.columns.setBy}</th>
                  <th scope="col">{t.columns.strikes}</th>
                  <td />
                </tr>
              </thead>
              <tbody>
                {lists.suspensions.map((row) => (
                  <tr key={row.account_id}>
                    <td className="nowrap">{row.account}</td>
                    <td className="nowrap">
                      <span className={`status ${row.banned ? 'danger' : 'warning'}`}>
                        <span className="dot" aria-hidden="true" />
                        {row.banned ? t.banned : t.until(text.whenFull(row.suspended_until))}
                      </span>
                    </td>
                    <td>
                      {row.by_rules ? t.byRules : t.byHand}
                      <span className="muted small plate-partners">{t.times(row.suspensions)}</span>
                    </td>
                    <td className="nowrap">{row.strikes_now}</td>
                    <td className="end">
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busy}
                        onClick={() => void act({ title: t.lift, body: t.liftAsk(row.account), confirmLabel: t.lift }, () => api.lift(row.account_id), t.lifted)}>
                        {t.lift}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lists && counts[tab] > 0 && <p className="table-foot">{t.showing(counts[tab])}</p>}
      </div>

      {viewing?.kind === 'report' && (
        <ReportDetails post={viewing.post} busy={busy} onClose={() => setViewing(null)} onConfirm={confirmReport} onDismiss={dismissReport} />
      )}
      {viewing?.kind === 'appeal' && <AppealDetails appeal={viewing.appeal} busy={busy} onClose={() => setViewing(null)} onDecide={decideAppeal} />}
    </>
  );
}

function ReportStatus({ post }: { post: FlaggedPost }) {
  if (post.needs_review) return <span className="status primary">{t.needsYou}</span>;
  if (post.struck) return <span className="status warning">{t.struckBadge}</span>;
  return <span className={`status ${post.hidden ? 'danger' : 'muted'}`}>{post.hidden ? t.hiddenBadge : t.shownBadge}</span>;
}

// A modal like the Drivers page's: opened on mount, closed by Close, Escape or a click outside
function useModal() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return dialog;
}

function ReportDetails({
  post,
  busy,
  onClose,
  onConfirm,
  onDismiss,
}: {
  post: FlaggedPost;
  busy: boolean;
  onClose: () => void;
  onConfirm: (post: FlaggedPost) => void;
  onDismiss: (post: FlaggedPost) => void;
}) {
  const dialog = useModal();
  const hint = evidenceHint(post);
  const fields: [string, string][] = [
    [t.fields.report, `${post.route_id} · ${phraseOf(post.phrase)}`],
    [t.fields.author, post.author],
    [t.fields.posted, text.whenFull(post.posted_at)],
    [t.fields.where, post.live_map ? t.liveMap : t.crowdsourcePost],
    [t.fields.verified, post.verified ? t.yes : t.no],
    [t.fields.beacon, post.beacon_ok === true ? t.passed : post.beacon_ok === false ? t.failed : t.none],
    [t.fields.gps, post.with_gps ? t.yes : t.no],
    [t.fields.risk, post.risk_events === 0 ? t.none : t.riskCount(post.risk_events)],
    [t.fields.flags, t.flags(post.weighted_flags, post.flags)],
    [t.fields.tags, post.tags.length > 0 ? post.tags.map(tagOf).join(', ') : t.none],
    [t.fields.strikes, String(post.author_strikes)],
  ];
  if (post.author_suspended_until) fields.push([t.fields.suspended, text.whenFull(post.author_suspended_until)]);

  return (
    <dialog
      ref={dialog}
      className="details-dialog"
      aria-labelledby="report-details-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}>
      <div className="details-head">
        <span className="toolbar-icon">
          <Icon name="warning" />
        </span>
        <div className="toolbar-text">
          <h2 id="report-details-title">{t.reportTitle}</h2>
          <p className="details-sub">
            <ReportStatus post={post} />
          </p>
        </div>
        <form method="dialog">
          <button type="submit" className="icon-button" aria-label={t.close}>
            <Icon name="close" />
          </button>
        </form>
      </div>
      <dl className="details-list">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {post.notes.length > 0 && (
        <div className="details-note">
          <p className="detail-label">{t.notes}</p>
          <ul className="notes-list">
            {post.notes.map((note, index) => (
              <li key={`${post.post_id}-${index}`}>“{note}”</li>
            ))}
          </ul>
        </div>
      )}
      <p className={`callout details-note hint ${hint}`}>
        <Icon name={hint === 'likely_real' ? 'checkCircle' : hint === 'likely_false' ? 'warning' : 'info'} />
        {t.hints[hint]}
      </p>
      <div className="details-foot">
        <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>
          {t.close}
        </button>
        <button type="button" className="button secondary" disabled={busy} onClick={() => onDismiss(post)}>
          {t.dismiss}
        </button>
        {!post.struck && (
          <button type="button" className="button danger-soft" disabled={busy} onClick={() => onConfirm(post)}>
            {t.confirm}
          </button>
        )}
      </div>
    </dialog>
  );
}

function AppealDetails({ appeal, busy, onClose, onDecide }: { appeal: PendingAppeal; busy: boolean; onClose: () => void; onDecide: (appeal: PendingAppeal, upheld: boolean) => void }) {
  const dialog = useModal();
  const fields: [string, string][] = [
    [t.fields.account, appeal.account],
    [t.fields.strike, t.strikeReasons[appeal.strike_reason] ?? appeal.strike_reason],
    [t.fields.struck, text.whenFull(appeal.struck_at)],
    [t.fields.appealed, text.whenFull(appeal.appealed_at)],
  ];
  if (appeal.route_id) fields.push([t.fields.report, `${appeal.route_id} · ${phraseOf(appeal.phrase)}`]);
  if (appeal.verified !== null) {
    fields.push([t.fields.verified, appeal.verified ? t.yes : t.no]);
    fields.push([t.fields.beacon, appeal.beacon_ok === true ? t.passed : appeal.beacon_ok === false ? t.failed : t.none]);
    fields.push([t.fields.flags, String(appeal.flags)]);
  }

  return (
    <dialog
      ref={dialog}
      className="details-dialog"
      aria-labelledby="appeal-details-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}>
      <div className="details-head">
        <span className="toolbar-icon">
          <Icon name="send" />
        </span>
        <div className="toolbar-text">
          <h2 id="appeal-details-title">{t.appealTitle}</h2>
          <p className="details-sub">{appeal.account}</p>
        </div>
        <form method="dialog">
          <button type="submit" className="icon-button" aria-label={t.close}>
            <Icon name="close" />
          </button>
        </form>
      </div>
      <dl className="details-list">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="details-note">
        <p className="detail-label">{t.riderWrote}</p>
        <blockquote className="appeal-body">{appeal.body}</blockquote>
      </div>
      <div className="details-foot">
        <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>
          {t.close}
        </button>
        <button type="button" className="button secondary" disabled={busy} onClick={() => onDecide(appeal, false)}>
          {t.deny}
        </button>
        <button type="button" className="button primary" disabled={busy} onClick={() => onDecide(appeal, true)}>
          {t.uphold}
        </button>
      </div>
    </dialog>
  );
}

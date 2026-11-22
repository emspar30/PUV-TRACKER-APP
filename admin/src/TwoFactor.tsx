import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

import { adminMfaStep, FIRST_FACTOR_NAME, mayAddFactor, mayRemoveFactor, nextFactorName, totpCode, type AdminMfaStep } from '@/shared/auth/adminMfa';
import { ADMIN_MAX_AUTHENTICATORS } from '@/shared/config';
import { strings } from '@/strings';

import { Icon } from './Icon';

const text = strings.adminConsole;
const t = text.twoFactor;
type Enrollment = { factorId: string; qrCode: string; secret: string };
type Factor = { id: string; name: string; createdAt: string };

function verifiedFactors(totp: readonly { id: string; friendly_name?: string; created_at: string }[]): Factor[] {
  return totp.map((factor) => ({ id: factor.id, name: factor.friendly_name ?? FIRST_FACTOR_NAME, createdAt: factor.created_at }));
}

// Drops half-finished setups (scanned but never confirmed), then starts a new one to scan
async function enrollTotp(client: SupabaseClient, taken: readonly string[]) {
  const factors = await client.auth.mfa.listFactors();
  for (const factor of factors.data?.all ?? []) {
    if (factor.factor_type === 'totp' && factor.status !== 'verified') await client.auth.mfa.unenroll({ factorId: factor.id });
  }
  return client.auth.mfa.enroll({ factorType: 'totp', friendlyName: nextFactorName(taken) });
}

// Two-factor sign-in (owner, 2026-11-22): after the password, a 6-digit code from an authenticator app
// (Google Authenticator, Microsoft Authenticator and the like). The first time, the admin scans a QR
// code to set it up. The database refuses every admin action until this is done (is_admin() needs aal2).
// children: the console, shown once the session has the second factor.
export function TwoFactorGate({ client, children }: { client: SupabaseClient; children: React.ReactNode }) {
  const [step, setStep] = useState<AdminMfaStep | null>(null);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    const [level, factors] = await Promise.all([client.auth.mfa.getAuthenticatorAssuranceLevel(), client.auth.mfa.listFactors()]);
    if (level.error || factors.error) {
      setError(text.offline);
      return;
    }
    const verified = verifiedFactors(factors.data.totp);
    setFactors(verified);
    setFactorId((current) => (verified.some((factor) => factor.id === current) ? current : (verified[0]?.id ?? null)));
    setStep(adminMfaStep(level.data.currentLevel, verified.length));
  }, [client]);

  useEffect(() => {
    const first = setTimeout(() => void check(), 0);
    return () => clearTimeout(first);
  }, [check]);

  // First time: drop any half-finished setup, then make a new one to scan
  const startEnroll = useCallback(async () => {
    setBusy(true);
    setError(null);
    const { data, error: refused } = await enrollTotp(client, []);
    setBusy(false);
    if (refused || !data) {
      setError(text.failed(refused?.message ?? 'enroll'));
      return;
    }
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }, [client]);

  useEffect(() => {
    if (step !== 'enroll' || enrollment) return undefined;
    const first = setTimeout(() => void startEnroll(), 0);
    return () => clearTimeout(first);
  }, [step, enrollment, startEnroll]);

  async function submit() {
    const typed = totpCode(code);
    const id = step === 'enroll' ? enrollment?.factorId : factorId;
    if (!typed) return setError(t.codeInvalid);
    if (!id) return;
    setBusy(true);
    setError(null);
    const { error: refused } = await client.auth.mfa.challengeAndVerify({ factorId: id, code: typed });
    setBusy(false);
    if (refused) {
      setError(refused.code === 'mfa_verification_failed' ? t.codeWrong : text.failed(refused.message));
      return;
    }
    setCode('');
    await check();
  }

  if (step === 'console') return <>{children}</>;

  return (
    <main className="signin-page">
      <div className="signin">
        <div className="signin-brand">
          <span className="logo large">
            <Icon name="vehicle" size={28} />
          </span>
          <h1>{text.title}</h1>
          <p className="muted">{text.signIn.place}</p>
        </div>
        <form
          className="card form-card"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}>
          <div>
            <h2>{step === 'enroll' ? t.setupHeading : t.heading}</h2>
            <p className="muted">{step === 'enroll' ? t.setupBody : t.body}</p>
          </div>
          {step === 'enroll' && enrollment && (
            <div className="totp-setup">
              <img src={enrollment.qrCode} alt={t.qrAlt} width={180} height={180} />
              <p className="muted small">{t.secretLabel}</p>
              <code className="totp-secret">{enrollment.secret}</code>
            </div>
          )}
          {error && (
            <p className="notice error" role="alert">
              <Icon name="error" />
              {error}
            </p>
          )}
          {step === 'verify' && factors.length > 1 && (
            <div className="field">
              <label htmlFor="totp-app">{t.whichApp}</label>
              <select id="totp-app" value={factorId ?? ''} onChange={(event) => setFactorId(event.target.value)}>
                {factors.map((factor) => (
                  <option key={factor.id} value={factor.id}>
                    {factor.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {step !== null && (
            <div className="field">
              <label htmlFor="totp">{t.codeLabel}</label>
              <input
                id="totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
          )}
          <button type="submit" className="button primary block" disabled={busy || step === null}>
            {busy ? text.signIn.busy : t.submit}
          </button>
          <button type="button" className="button text block" onClick={() => void client.auth.signOut()}>
            {text.signOut}
          </button>
        </form>
      </div>
    </main>
  );
}

// Settings (2026-11-22, weak-point fixes): the authenticator apps of this admin account. A backup on a
// second phone means a lost phone does not lock the console; the last one cannot be removed.
export function TwoFactorSettings({ client }: { client: SupabaseClient }) {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const load = useCallback(async () => {
    const result = await client.auth.mfa.listFactors();
    if (result.error) setError(text.offline);
    else setFactors(verifiedFactors(result.data.totp));
  }, [client]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    return () => clearTimeout(first);
  }, [load]);

  async function startBackup() {
    if (!factors) return;
    setBusy(true);
    setError(null);
    setAdded(false);
    const { data, error: refused } = await enrollTotp(
      client,
      factors.map((factor) => factor.name),
    );
    setBusy(false);
    if (refused || !data) return setError(text.failed(refused?.message ?? 'enroll'));
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmBackup() {
    const typed = totpCode(code);
    if (!typed) return setError(t.codeInvalid);
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const { error: refused } = await client.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: typed });
    setBusy(false);
    if (refused) return setError(refused.code === 'mfa_verification_failed' ? t.codeWrong : text.failed(refused.message));
    setEnrollment(null);
    setCode('');
    setAdded(true);
    await load();
  }

  async function cancelBackup() {
    if (enrollment) await client.auth.mfa.unenroll({ factorId: enrollment.factorId });
    setEnrollment(null);
    setCode('');
    setError(null);
  }

  async function remove(factor: Factor) {
    if (!factors || !mayRemoveFactor(factors.length)) return setError(t.lastOne);
    if (!window.confirm(t.removeConfirm(factor.name))) return;
    setBusy(true);
    setError(null);
    setAdded(false);
    const { error: refused } = await client.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (refused) return setError(text.failed(refused.message));
    await load();
  }

  const count = factors?.length ?? 0;
  return (
    <section className="card form-card" aria-labelledby="mfa-heading">
      <div>
        <h2 id="mfa-heading">{t.manageHeading}</h2>
        <p className="muted">{t.manageBody}</p>
      </div>
      {factors && (
        <ul className="factor-list">
          {factors.map((factor) => (
            <li key={factor.id}>
              <span>
                <strong>{factor.name}</strong>
                <span className="muted small"> · {t.added(text.when(factor.createdAt))}</span>
              </span>
              <button type="button" className="button text" disabled={busy || !mayRemoveFactor(count)} onClick={() => void remove(factor)}>
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      {enrollment && (
        <form
          className="form-card"
          onSubmit={(event) => {
            event.preventDefault();
            void confirmBackup();
          }}>
          <p className="muted">{t.backupSetupBody}</p>
          <div className="totp-setup">
            <img src={enrollment.qrCode} alt={t.qrAlt} width={180} height={180} />
            <p className="muted small">{t.secretLabel}</p>
            <code className="totp-secret">{enrollment.secret}</code>
          </div>
          <div className="field">
            <label htmlFor="totp-backup">{t.codeLabel}</label>
            <input
              id="totp-backup"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <div className="actions">
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? text.signIn.busy : t.submit}
            </button>
            <button type="button" className="button text" disabled={busy} onClick={() => void cancelBackup()}>
              {t.cancel}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="notice error" role="alert">
          <Icon name="error" />
          {error}
        </p>
      )}
      {added && (
        <p className="notice ok" role="status">
          <Icon name="checkCircle" />
          {t.backupAdded}
        </p>
      )}
      {factors && !enrollment && (
        <div className="actions">
          <button type="button" className="button" disabled={busy || !mayAddFactor(count)} onClick={() => void startBackup()}>
            {t.addBackup}
          </button>
          {!mayAddFactor(count) && <span className="muted small">{t.atLimit(ADMIN_MAX_AUTHENTICATORS)}</span>}
        </div>
      )}
    </section>
  );
}

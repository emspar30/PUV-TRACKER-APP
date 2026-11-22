import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

import { adminMfaStep, totpCode, type AdminMfaStep } from '@/shared/auth/adminMfa';
import { strings } from '@/strings';

import { Icon } from './Icon';

const text = strings.adminConsole;
const t = text.twoFactor;
const FRIENDLY_NAME = 'Tunton admin';

type Enrollment = { factorId: string; qrCode: string; secret: string };

// Two-factor sign-in (owner, 2026-11-22): after the password, a 6-digit code from an authenticator app
// (Google Authenticator, Microsoft Authenticator and the like). The first time, the admin scans a QR
// code to set it up. The database refuses every admin action until this is done (is_admin() needs aal2).
// children: the console, shown once the session has the second factor.
export function TwoFactorGate({ client, children }: { client: SupabaseClient; children: React.ReactNode }) {
  const [step, setStep] = useState<AdminMfaStep | null>(null);
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
    const verified = factors.data.totp;
    setFactorId(verified[0]?.id ?? null);
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
    const factors = await client.auth.mfa.listFactors();
    for (const factor of factors.data?.all ?? []) {
      if (factor.factor_type === 'totp' && factor.status !== 'verified') await client.auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data, error: refused } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: FRIENDLY_NAME });
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

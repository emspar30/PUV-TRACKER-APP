import { useEffect, useState } from 'react';

import { ADMIN_PIN_DIGITS } from '@/shared/config';
import { isValidPin } from '@/shared/driver/provisioning';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { errorText } from './errors';

const text = strings.adminConsole;
const t = text.settings;

const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, ADMIN_PIN_DIGITS);

// The one admin PIN of the pilot driver phones (D5). It goes into each setup a phone collects from now
// on; only its salted hash leaves the page.
export function Settings({ api, email }: { api: ConsoleApi; email: string }) {
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void api.pinIsSet().then((result) => {
      if (!live) return;
      if (result.ok) setPinSet(result.value);
      else setError(result.error);
    });
    return () => {
      live = false;
    };
  }, [api]);

  const problem =
    pin.length > 0 && !isValidPin(pin) && again.length > 0
      ? t.pinInvalid(ADMIN_PIN_DIGITS)
      : again.length === ADMIN_PIN_DIGITS && again !== pin
        ? t.pinMismatch
        : null;
  const ready = isValidPin(pin) && pin === again;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await api.setPin(pin);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPinSet(true);
    setSaved(true);
    setPin('');
    setAgain('');
  }

  return (
    <section aria-labelledby="pin-heading" className="settings">
      <form
        className="card"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) void save();
        }}>
        <h2 id="pin-heading">{t.pinHeading}</h2>
        <p className="muted">{t.pinBody}</p>
        {pinSet !== null && <p className={pinSet ? 'notice' : 'notice warning'}>{pinSet ? t.pinSet : t.pinNotSet}</p>}
        <div className="field">
          <label htmlFor="pin">{t.newPin(ADMIN_PIN_DIGITS)}</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={ADMIN_PIN_DIGITS}
            value={pin}
            onChange={(event) => {
              setPin(digitsOnly(event.target.value));
              setSaved(false);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="pin-again">{t.pinAgain}</label>
          <input
            id="pin-again"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={ADMIN_PIN_DIGITS}
            value={again}
            onChange={(event) => {
              setAgain(digitsOnly(event.target.value));
              setSaved(false);
            }}
          />
        </div>
        {problem && <p className="notice warning">{problem}</p>}
        {error && (
          <p className="notice error" role="alert">
            {errorText(error)}
          </p>
        )}
        {saved && (
          <p className="notice ok" role="status">
            {t.pinSaved}
          </p>
        )}
        <button type="submit" className="button primary" disabled={busy || !ready}>
          {busy ? text.registrations.saving : t.savePin}
        </button>
      </form>
      {email && <p className="muted small">{t.account(email)}</p>}
    </section>
  );
}

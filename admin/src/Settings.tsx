import { useEffect, useState } from 'react';

import { ADMIN_PIN_DIGITS } from '@/shared/config';
import { isValidPin } from '@/shared/driver/provisioning';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { errorText } from './errors';
import { Icon } from './Icon';
import { PageHeader } from './PageHeader';
import { SecretInput } from './SecretInput';

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

  function clear() {
    setPin('');
    setAgain('');
    setSaved(false);
  }

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <form
        className="card form-card"
        aria-labelledby="pin-heading"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) void save();
        }}>
        <div>
          <h2 id="pin-heading">{t.pinHeading}</h2>
          <p className="muted">{t.pinBody}</p>
        </div>
        {pinSet !== null && (
          <p className={pinSet ? 'callout' : 'notice warning'}>
            <Icon name={pinSet ? 'info' : 'warning'} />
            {pinSet ? t.pinSet : t.pinNotSet}
          </p>
        )}
        <div className="field">
          <label htmlFor="pin">{t.newPin(ADMIN_PIN_DIGITS)}</label>
          <SecretInput
            id="pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={ADMIN_PIN_DIGITS}
            value={pin}
            showLabel={t.showPin}
            hideLabel={t.hidePin}
            onChange={(event) => {
              setPin(digitsOnly(event.target.value));
              setSaved(false);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="pin-again">{t.pinAgain}</label>
          <SecretInput
            id="pin-again"
            inputMode="numeric"
            autoComplete="off"
            maxLength={ADMIN_PIN_DIGITS}
            value={again}
            showLabel={t.showPin}
            hideLabel={t.hidePin}
            onChange={(event) => {
              setAgain(digitsOnly(event.target.value));
              setSaved(false);
            }}
          />
        </div>
        {problem && (
          <p className="notice warning">
            <Icon name="warning" />
            {problem}
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            <Icon name="error" />
            {errorText(error)}
          </p>
        )}
        {saved && (
          <p className="notice ok" role="status">
            <Icon name="checkCircle" />
            {t.pinSaved}
          </p>
        )}
        <div className="actions">
          <button type="submit" className="button primary" disabled={busy || !ready}>
            {busy ? text.registrations.saving : t.savePin}
          </button>
          <button type="button" className="button text" disabled={busy || (pin === '' && again === '')} onClick={clear}>
            {t.clear}
          </button>
        </div>
      </form>
      {email && <p className="muted small">{t.account(email)}</p>}
    </>
  );
}

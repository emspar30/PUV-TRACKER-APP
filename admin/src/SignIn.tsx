import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';

import { strings } from '@/strings';

import { Icon } from './Icon';
import { SecretInput } from './SecretInput';

const text = strings.adminConsole;

// The admin account's email and password (D4: one account, made in Supabase; admin/README.md)
export function SignIn({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const { error: refused } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (refused) {
        if (refused.code === 'invalid_credentials') setError(text.signIn.wrong);
        else if (refused.name === 'AuthRetryableFetchError') setError(text.offline);
        else setError(text.failed(refused.message));
      }
    } catch {
      setError(text.offline);
    }
    setBusy(false);
  }

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
            void signIn();
          }}>
          <div>
            <h2>{text.signIn.heading}</h2>
            <p className="muted">{text.signIn.body}</p>
          </div>
          {error && (
            <p className="notice error" role="alert">
              <Icon name="error" />
              {error}
            </p>
          )}
          <div className="field">
            <label htmlFor="email">{text.signIn.email}</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">{text.signIn.password}</label>
            <SecretInput
              id="password"
              autoComplete="current-password"
              required
              value={password}
              showLabel={text.signIn.showPassword}
              hideLabel={text.signIn.hidePassword}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button type="submit" className="button primary block" disabled={busy}>
            {busy ? text.signIn.busy : text.signIn.submit}
          </button>
        </form>
      </div>
    </main>
  );
}

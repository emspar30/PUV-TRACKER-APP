import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';

import { strings } from '@/strings';

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
    <main className="page narrow signin">
      <h1 className="brand">{text.title}</h1>
      <form
        className="card"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn();
        }}>
        <h2>{text.signIn.heading}</h2>
        <p className="muted">{text.signIn.body}</p>
        <div className="field">
          <label htmlFor="email">{text.signIn.email}</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">{text.signIn.password}</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? text.signIn.busy : text.signIn.submit}
        </button>
      </form>
    </main>
  );
}

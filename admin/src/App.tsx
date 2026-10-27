import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { strings } from '@/strings';

import { Drivers } from './Drivers';
import { Registrations } from './Registrations';
import { Settings } from './Settings';
import { SignIn } from './SignIn';
import { api, client } from './supabase';

const text = strings.adminConsole;

// The tab is the page address's #part, so a reload or a shared link opens the same tab
const TABS = ['registrations', 'drivers', 'settings'] as const;
type Tab = (typeof TABS)[number];

function tabFromAddress(): Tab {
  const wanted = window.location.hash.slice(1);
  return TABS.find((tab) => tab === wanted) ?? 'registrations';
}

export function App() {
  const supabase = client;
  // undefined until Supabase says whether this browser is signed in
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  const [tab, setTab] = useState<Tab>(tabFromAddress);

  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const follow = () => setTab(tabFromAddress());
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);

  if (!supabase || !api) {
    return (
      <main className="page narrow">
        <p className="notice error">{text.notConfigured}</p>
      </main>
    );
  }
  if (session === undefined) return null;
  if (!session) return <SignIn client={supabase} />;

  return (
    <>
      <header className="topbar">
        <h1 className="brand">{text.title}</h1>
        <nav className="tabs" aria-label={text.title}>
          {TABS.map((name) => (
            <a key={name} href={`#${name}`} className="tab" aria-current={tab === name ? 'page' : undefined}>
              {text.tabs[name]}
            </a>
          ))}
        </nav>
        <button type="button" className="button quiet" onClick={() => void supabase.auth.signOut()}>
          {text.signOut}
        </button>
      </header>
      <main className="page">
        {tab === 'registrations' && <Registrations api={api} />}
        {tab === 'drivers' && <Drivers api={api} />}
        {tab === 'settings' && <Settings api={api} email={session.user.email ?? ''} />}
      </main>
    </>
  );
}

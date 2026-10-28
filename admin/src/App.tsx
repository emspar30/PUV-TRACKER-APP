import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { splitRegistrations } from '@/shared/driver/registrationConsole';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { Drivers } from './Drivers';
import { Icon, type IconName } from './Icon';
import { Registrations } from './Registrations';
import { Settings } from './Settings';
import { SignIn } from './SignIn';
import { api, client } from './supabase';
import { useRegistrations } from './useRegistrations';

const text = strings.adminConsole;

// The section is the page address's #part, so a reload or a shared link opens the same one
const TABS = ['registrations', 'drivers', 'settings'] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, IconName> = { registrations: 'registrations', drivers: 'drivers', settings: 'settings' };

function tabFromAddress(): Tab {
  const wanted = window.location.hash.slice(1);
  return TABS.find((tab) => tab === wanted) ?? 'registrations';
}

export function App() {
  const supabase = client;
  // undefined until Supabase says whether this browser is signed in
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);

  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase || !api) {
    return (
      <main className="signin-page">
        <p className="notice error">{text.notConfigured}</p>
      </main>
    );
  }
  if (session === undefined) return null;
  if (!session) return <SignIn client={supabase} />;
  return <Console api={api} email={session.user.email ?? ''} onSignOut={() => void supabase.auth.signOut()} />;
}

// Signed in: the side navigation and the open section
function Console({ api, email, onSignOut }: { api: ConsoleApi; email: string; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>(tabFromAddress);
  const registrations = useRegistrations(api);
  const waiting = registrations.rows ? splitRegistrations(registrations.rows).waiting.length : 0;

  useEffect(() => {
    const follow = () => setTab(tabFromAddress());
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">
            <Icon name="vehicle" size={18} />
          </span>
          <div>
            <p className="brand-name">{text.title}</p>
            <p className="brand-sub">{text.brandSub}</p>
          </div>
        </div>
        <nav className="sidenav" aria-label={text.sections}>
          {TABS.map((name) => (
            <a key={name} href={`#${name}`} className="sidenav-link" aria-current={tab === name ? 'page' : undefined}>
              <Icon name={TAB_ICONS[name]} />
              <span>{text.tabs[name]}</span>
              {name === 'registrations' && waiting > 0 && <span className="count">{waiting}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          {email && (
            <p className="account" title={email}>
              <span className="dot ok" aria-hidden="true" />
              <span>{email}</span>
            </p>
          )}
          <button type="button" className="signout" onClick={onSignOut}>
            <Icon name="signOut" size={16} />
            {text.signOut}
          </button>
        </div>
      </aside>
      <main className="workspace">
        <div className="workspace-inner">
          {tab === 'registrations' && <Registrations api={api} state={registrations} />}
          {tab === 'drivers' && <Drivers api={api} registrations={registrations.rows} />}
          {tab === 'settings' && <Settings api={api} email={email} />}
        </div>
      </main>
    </div>
  );
}

import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

import { idleExpired } from '@/shared/auth/adminMfa';
import { ADMIN_IDLE_CHECK_S, ADMIN_IDLE_SIGNOUT_MIN, CONSOLE_REFRESH_S } from '@/shared/config';
import { splitRegistrations } from '@/shared/driver/registrationConsole';
import { waitingCount, type ModerationWaiting } from '@/shared/moderation/console';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { Drivers } from './Drivers';
import { Icon, type IconName } from './Icon';
import { Moderation } from './Moderation';
import { Registrations } from './Registrations';
import { Settings } from './Settings';
import { SignIn } from './SignIn';
import { api, client } from './supabase';
import { TwoFactorGate } from './TwoFactor';
import { useRegistrations } from './useRegistrations';

const text = strings.adminConsole;

// The section is the page address's #part, so a reload or a shared link opens the same one
const TABS = ['registrations', 'drivers', 'moderation', 'settings'] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, IconName> = { registrations: 'registrations', drivers: 'drivers', moderation: 'shield', settings: 'settings' };

function tabFromAddress(): Tab {
  const wanted = window.location.hash.slice(1);
  return TABS.find((tab) => tab === wanted) ?? 'registrations';
}

export function App() {
  const supabase = client;
  // undefined until Supabase says whether this browser is signed in
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  const [idleOut, setIdleOut] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) setIdleOut(false);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useIdleSignOut(Boolean(session), () => {
    setIdleOut(true);
    void supabase?.auth.signOut();
  });

  if (!supabase || !api) {
    return (
      <main className="signin-page">
        <p className="notice error">{text.notConfigured}</p>
      </main>
    );
  }
  if (session === undefined) return null;
  if (!session) return <SignIn client={supabase} notice={idleOut ? text.idleSignedOut(ADMIN_IDLE_SIGNOUT_MIN) : null} />;
  // 2026-11-22: the console opens only after the second factor (the database checks it too)
  return (
    <TwoFactorGate key={session.user.id} client={supabase}>
      <Console api={api} client={supabase} email={session.user.email ?? ''} userId={session.user.id} onSignOut={() => void supabase.auth.signOut()} />
    </TwoFactorGate>
  );
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

// 2026-11-22 (weak-point fixes): a signed-in console with no click, key press, scroll or touch for
// ADMIN_IDLE_SIGNOUT_MIN signs out, so a console left open on a shared PC does not stay signed in.
// Checked every ADMIN_IDLE_CHECK_S and when the browser tab is shown again.
function useIdleSignOut(signedIn: boolean, onIdle: () => void) {
  const lastActive = useRef(0);
  const idle = useRef(onIdle);
  useEffect(() => {
    idle.current = onIdle;
  });

  useEffect(() => {
    if (!signedIn) return undefined;
    lastActive.current = Date.now();
    const touch = () => {
      lastActive.current = Date.now();
    };
    const check = () => {
      if (idleExpired(lastActive.current, Date.now())) idle.current();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, touch, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, ADMIN_IDLE_CHECK_S * 1000);
    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, touch, { capture: true }));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [signedIn]);
}

// Signed in: the side navigation and the open section
function Console({
  api,
  client,
  email,
  userId,
  onSignOut,
}: {
  api: ConsoleApi;
  client: SupabaseClient;
  email: string;
  userId: string;
  onSignOut: () => void;
}) {
  const [tab, setTab] = useState<Tab>(tabFromAddress);
  const registrations = useRegistrations(api);
  const waiting = registrations.rows ? splitRegistrations(registrations.rows).waiting.length : 0;
  // 2026-11-23: what waits on the Moderation page (flagged verified rides and appeals)
  const [moderation, setModeration] = useState<ModerationWaiting | null>(null);
  const loadModeration = useCallback(async () => {
    const result = await api.moderationWaiting();
    if (result.ok) setModeration(result.value);
  }, [api]);
  useEffect(() => {
    const first = setTimeout(() => void loadModeration(), 0);
    const timer = setInterval(() => void loadModeration(), CONSOLE_REFRESH_S * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [loadModeration]);
  const counts: Partial<Record<Tab, number>> = { registrations: waiting, moderation: waitingCount(moderation) };

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
              {(counts[name] ?? 0) > 0 && <span className="count">{counts[name]}</span>}
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
          {tab === 'moderation' && <Moderation api={api} onChanged={() => void loadModeration()} />}
          {tab === 'settings' && <Settings api={api} client={client} email={email} userId={userId} />}
        </div>
      </main>
    </div>
  );
}

import Storage from 'expo-sqlite/kv-store';

import { isOtherAccount } from '@/shared/auth/gate';

import { resetApp } from './resetApp';
import { useSessionStore } from './sessionStore';

// Emjay, 2026-11-02: the account this phone's data belongs to. When another account signs in, the
// phone is cleared as by Reset app (username, badges, rides, history, the introduction done, the
// profile kept on the phone), so the new account starts with the introduction and sees nothing of
// the last one. Signing out keeps the data, so the same account signing back in finds it. The id
// stays on the phone.
const OWNER_KEY = 'account-owner';

function readOwner(): string | null {
  try {
    return Storage.getItemSync(OWNER_KEY);
  } catch {
    return null;
  }
}

let started = false;

export function startAccountGuard(): void {
  if (started) return;
  started = true;
  useSessionStore.subscribe((state, previous) => {
    if (state.userId === previous.userId || state.userId === null) return;
    if (isOtherAccount(readOwner(), state.userId)) resetApp();
    Storage.setItemSync(OWNER_KEY, state.userId);
  });
}

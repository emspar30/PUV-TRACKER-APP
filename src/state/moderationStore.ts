import { ShieldCheck } from 'lucide-react-native';
import { create } from 'zustand';

import { ackShieldNotice, loadModeration, type Moderation } from '@/services/moderation';
import { strings } from '@/strings';

import { showDialog } from './dialogStore';
import { useSettingsStore } from './settingsStore';
import { showToast } from './toastStore';

// MOD1: the rider's own moderation state, read when the app opens and when Profile opens. Live data
// only; demo data has no strikes. A Merit point that absorbed a strike is told once.
type ModerationState = {
  snapshot: Moderation | null;
  set: (snapshot: Moderation | null) => void;
};

export const useModerationStore = create<ModerationState>((set) => ({
  snapshot: null,
  set: (snapshot) => set({ snapshot }),
}));

export async function refreshModeration(): Promise<void> {
  if (useSettingsStore.getState().demoData) {
    useModerationStore.getState().set(null);
    return;
  }
  const snapshot = await loadModeration();
  useModerationStore.getState().set(snapshot);
  if (snapshot?.shieldNotice) {
    showToast({ inbox: true, icon: ShieldCheck, title: strings.moderation.shieldTitle, body: strings.moderation.shieldBody });
    void ackShieldNotice();
  }
}

// A suspended rider is told why instead of relaying, checking in or flagging. true: suspended
export function blockedBySuspension(nowMs = Date.now()): boolean {
  const until = useModerationStore.getState().snapshot?.suspendedUntilMs ?? null;
  if (until === null || until <= nowMs) return false;
  showDialog({ tone: 'danger', title: strings.moderation.suspendedTitle, body: strings.moderation.suspendedBody(new Date(until)) });
  return true;
}

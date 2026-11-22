import { Flag, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { create } from 'zustand';

import { ackModerationNotices, ackShieldNotice, loadModeration, type Moderation } from '@/services/moderation';
import { dialogNotice, inboxNotices, type ModerationNotice } from '@/shared/moderation/notices';
import { strings } from '@/strings';

import { showDialog } from './dialogStore';
import { useSettingsStore } from './settingsStore';
import { showToast } from './toastStore';

// MOD1: the rider's own moderation state, read when the app opens, when Profile opens and when
// Crowdsource opens. Live data only; demo data has no strikes. Since 2026-11-23 the server's notices
// (a flag on their report, a strike, a suspension, a ban, a lift, an appeal decided) are shown once: a
// suspension, ban or lift as a dialog, the rest in the in-app notifications.
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
  if (!snapshot) return;
  const notices = snapshot.notices;
  // The older one-time shield notice, unless the new notices already say it
  if (snapshot.shieldNotice) {
    if (!notices.some((notice) => notice.kind === 'shielded')) {
      showToast({ inbox: true, icon: ShieldCheck, title: strings.moderation.shieldTitle, body: strings.moderation.shieldBody });
    }
    void ackShieldNotice();
  }
  if (notices.length === 0) return;
  for (const notice of inboxNotices(notices)) {
    const text = noticeText(notice);
    showToast({ inbox: true, icon: notice.kind === 'flagged' ? Flag : notice.kind === 'strike' ? ShieldAlert : ShieldCheck, title: text.title, body: text.body });
  }
  const serious = dialogNotice(notices);
  if (serious) {
    const text = noticeText(serious);
    showDialog({ tone: serious.kind === 'lifted' ? 'success' : 'danger', title: text.title, body: text.body });
  }
  void ackModerationNotices();
}

function noticeText(notice: ModerationNotice): { title: string; body: string } {
  const n = strings.moderation.notices;
  switch (notice.kind) {
    case 'flagged':
      return { title: n.flaggedTitle, body: n.flaggedBody(notice.tag ? strings.crowdsource.flagTags[notice.tag] : null) };
    case 'strike':
      return { title: n.strikeTitle, body: n.strikeBody };
    case 'shielded':
      return { title: strings.moderation.shieldTitle, body: strings.moderation.shieldBody };
    case 'suspended':
      return { title: strings.moderation.suspendedTitle, body: strings.moderation.suspendedBody(new Date(notice.untilMs ?? Date.now())) };
    case 'banned':
      return { title: strings.moderation.bannedTitle, body: strings.moderation.bannedBody };
    case 'lifted':
      return { title: n.liftedTitle, body: n.liftedBody };
    case 'appeal_upheld':
      return { title: n.upheldTitle, body: n.upheldBody };
    case 'appeal_denied':
      return { title: n.deniedTitle, body: n.deniedBody };
  }
}

// A suspended rider is told why instead of relaying, checking in or flagging. true: suspended
export function blockedBySuspension(nowMs = Date.now()): boolean {
  const snapshot = useModerationStore.getState().snapshot;
  const until = snapshot?.suspendedUntilMs ?? null;
  if (until === null || until <= nowMs) return false;
  if (snapshot?.banned) showDialog({ tone: 'danger', title: strings.moderation.bannedTitle, body: strings.moderation.bannedBody });
  else showDialog({ tone: 'danger', title: strings.moderation.suspendedTitle, body: strings.moderation.suspendedBody(new Date(until)) });
  return true;
}

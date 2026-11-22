// The rider's moderation notices (owner, 2026-11-23; migration 20261123000000_auto_moderation.sql):
// my_moderation() returns the unseen ones, newest first. A suspension, ban or lift is shown as a
// dialog (the most serious one); the others go to the in-app notifications. Also the flags this phone
// sent, kept so a flagged report keeps its red flag after a restart. Pure: times are passed in.

import { FLAGGED_KEEP_H } from '../config';
import type { FlagTag } from '../config';

export type NoticeKind = 'flagged' | 'strike' | 'shielded' | 'suspended' | 'banned' | 'lifted' | 'appeal_upheld' | 'appeal_denied';

export type ModerationNotice = { id: string; kind: NoticeKind; tag: FlagTag | null; untilMs: number | null; createdMs: number };

const KINDS: readonly NoticeKind[] = ['flagged', 'strike', 'shielded', 'suspended', 'banned', 'lifted', 'appeal_upheld', 'appeal_denied'];
// Shown as a dialog, most serious first
const DIALOG_ORDER: readonly NoticeKind[] = ['banned', 'suspended', 'lifted'];
const MS_PER_H = 3_600_000;

type NoticeRow = { id: number | string; kind: string; tag: string | null; until: string | null; created_at: string };

// Rows the server sent, minus any kind this app does not know (a newer server)
export function noticesOf(rows: readonly NoticeRow[] | null | undefined): ModerationNotice[] {
  return (rows ?? [])
    .filter((row) => (KINDS as readonly string[]).includes(row.kind))
    .map((row) => ({
      id: String(row.id),
      kind: row.kind as NoticeKind,
      tag: (row.tag as FlagTag | null) ?? null,
      untilMs: row.until ? Date.parse(row.until) : null,
      createdMs: Date.parse(row.created_at),
    }));
}

// The one notice worth a dialog (ban, suspension, lift), newest of the most serious kind; null if none
export function dialogNotice(notices: readonly ModerationNotice[]): ModerationNotice | null {
  for (const kind of DIALOG_ORDER) {
    const found = notices.find((notice) => notice.kind === kind);
    if (found) return found;
  }
  return null;
}

// The rest, for the in-app notifications, oldest first
export function inboxNotices(notices: readonly ModerationNotice[]): ModerationNotice[] {
  return notices.filter((notice) => !DIALOG_ORDER.includes(notice.kind)).sort((a, b) => a.createdMs - b.createdMs);
}

// The flags this phone sent (post id: when), without those older than FLAGGED_KEEP_H (the report is
// long gone from the feed by then)
export function keepFlagged(flagged: Readonly<Record<string, number>>, nowMs: number): Record<string, number> {
  return Object.fromEntries(Object.entries(flagged).filter(([, atMs]) => nowMs - atMs < FLAGGED_KEEP_H * MS_PER_H));
}

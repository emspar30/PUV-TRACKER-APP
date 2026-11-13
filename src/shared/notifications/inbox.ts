// The Notifications page's list (PRD 7, "Prompts shown only in-app"): the in-app notices worth
// reading again, such as arrival alerts, check-in and relay updates and new badges. Newest first,
// at most NOTIFICATIONS_KEEP. Pure: no React Native or Expo imports.

import { NOTIFICATIONS_KEEP } from '../config';

export type InboxItem = {
  id: string;
  title: string;
  body: string | null;
  atMs: number;
};

export function addToInbox(items: readonly InboxItem[], item: InboxItem, keep = NOTIFICATIONS_KEEP): InboxItem[] {
  return [item, ...items.filter((old) => old.id !== item.id)].slice(0, keep);
}

// Tester note, 2026-11-05: the bell shows a dot while a notification came in after the list was last opened
export function hasUnread(items: readonly InboxItem[], seenAtMs: number): boolean {
  return items.some((item) => item.atMs > seenAtMs);
}

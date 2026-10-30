// The Notifications page's list: newest first, no repeats, at most NOTIFICATIONS_KEEP.

import { NOTIFICATIONS_KEEP } from '../config';
import { addToInbox, type InboxItem } from '../notifications/inbox';

const item = (n: number): InboxItem => ({ id: `id-${n}`, title: `Notice ${n}`, body: null, atMs: n });

describe('notifications inbox', () => {
  it('puts the newest first', () => {
    const items = addToInbox(addToInbox([], item(1)), item(2));
    expect(items.map((i) => i.id)).toEqual(['id-2', 'id-1']);
  });

  it('keeps one copy of the same notice', () => {
    const items = addToInbox([item(1), item(2)], item(1));
    expect(items.map((i) => i.id)).toEqual(['id-1', 'id-2']);
  });

  it('drops the oldest past the limit', () => {
    let items: InboxItem[] = [];
    for (let n = 0; n < NOTIFICATIONS_KEEP + 5; n += 1) items = addToInbox(items, item(n));
    expect(items).toHaveLength(NOTIFICATIONS_KEEP);
    expect(items[0].id).toBe(`id-${NOTIFICATIONS_KEEP + 4}`);
    expect(items.at(-1)?.id).toBe('id-5');
  });
});

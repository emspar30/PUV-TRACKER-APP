// The rider's moderation notices and the flags kept on the phone (owner, 2026-11-23).

import { FLAGGED_KEEP_H } from '../config';
import { dialogNotice, inboxNotices, keepFlagged, noticesOf } from '../moderation/notices';

const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 23, 12);

const row = (id: number, kind: string, minutesAgo: number, extra: { tag?: string | null; until?: string | null } = {}) => ({
  id,
  kind,
  tag: extra.tag ?? null,
  until: extra.until ?? null,
  created_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
});

describe('moderation notices', () => {
  it('reads the rows, and skips a kind this app does not know', () => {
    const notices = noticesOf([row(1, 'flagged', 5, { tag: 'spamming' }), row(2, 'something_new', 4), row(3, 'suspended', 1, { until: '2026-11-30T12:00:00Z' })]);
    expect(notices.map((notice) => notice.kind)).toEqual(['flagged', 'suspended']);
    expect(notices[0].tag).toBe('spamming');
    expect(notices[1].untilMs).toBe(Date.parse('2026-11-30T12:00:00Z'));
    expect(noticesOf(null)).toEqual([]);
  });

  it('shows the most serious of ban, suspension and lift as a dialog; the rest go to the inbox, oldest first', () => {
    const notices = noticesOf([row(4, 'banned', 1), row(3, 'strike', 2), row(2, 'suspended', 30), row(1, 'flagged', 40)]);
    expect(dialogNotice(notices)?.kind).toBe('banned');
    expect(inboxNotices(notices).map((notice) => notice.kind)).toEqual(['flagged', 'strike']);
    expect(dialogNotice(noticesOf([row(1, 'flagged', 1)]))).toBeNull();
  });

  it('keeps a flag sent from this phone for FLAGGED_KEEP_H', () => {
    const kept = keepFlagged({ old: NOW - FLAGGED_KEEP_H * H, recent: NOW - H }, NOW);
    expect(kept).toEqual({ recent: NOW - H });
  });
});

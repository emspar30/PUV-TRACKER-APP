// MOD1b: the app's mapping of my_moderation.

import { moderationOf } from '../moderation';

jest.mock('../supabase', () => ({ getSupabase: jest.fn(), isSupabaseConfigured: () => true }));

describe('my_moderation in the app', () => {
  it('maps the server answer', () => {
    expect(
      moderationOf({
        trust_level: 90,
        reports: 12,
        merit: 1,
        suspended_until: '2026-11-09T00:00:00Z',
        shield_notice: true,
        strikes: [{ id: 7, reason: 'confirmed_report', created_at: '2026-11-02T00:00:00Z', expires_at: '2027-01-01T00:00:00Z', absorbed: false, lifted: false, appeal_state: 'none' }],
      }),
    ).toEqual({
      trustLevel: 90,
      reports: 12,
      merit: 1,
      suspendedUntilMs: Date.parse('2026-11-09T00:00:00Z'),
      shieldNotice: true,
      strikes: [{ id: '7', reason: 'confirmed_report', createdMs: Date.parse('2026-11-02T00:00:00Z'), expiresMs: Date.parse('2027-01-01T00:00:00Z'), absorbed: false, lifted: false, appealState: 'none' }],
    });
  });
});

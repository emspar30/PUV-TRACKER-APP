import { useSettingsStore } from '@/state/settingsStore';

import { getSupabase, isSupabaseConfigured } from './supabase';

// RK1 (PRD 10.3): the phone refuses a mock (fake GPS) fix for a check-in or a relay (acceptFix), and
// tells the server once per app session, so a repeat offender can be reviewed. Best effort: a
// failure is ignored and nothing waits for it. Not with demo data, where testers may fake GPS.
let reported = false;

export function reportMockLocation(): void {
  if (reported || useSettingsStore.getState().demoData || !isSupabaseConfigured()) return;
  reported = true;
  void (async () => {
    try {
      await getSupabase().rpc('report_risk', { kind: 'mock_location' });
    } catch {
      // Best effort
    }
  })();
}

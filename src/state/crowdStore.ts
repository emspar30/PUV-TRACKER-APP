import { useMemo } from 'react';

import { createDemoCrowd } from '@/data/demo/demoCrowd';
import { createLiveCrowd } from '@/data/live/liveCrowd';
import { selectCrowd, type CrowdRepositories } from '@/data/repositories/select';
import type { CheckInResult, ReportInput, ReportResult } from '@/data/repositories/types';
import { supabaseCrowdPort } from '@/services/crowd';
import { isSupabaseConfigured } from '@/services/supabase';
import { newRequestKey } from '@/shared/backend/rules';
import { DEMO_SEED } from '@/shared/config';

import { useCheckInStore } from './checkinStore';
import { demoEnergy, refreshEnergy } from './energyStore';
import { useSettingsStore } from './settingsStore';
import { useUsernameStore } from './usernameStore';

// Check-ins (C1) and reports (RP1) from the source the "Demo data" switch picks. One instance of
// each, so the demo check-in, its count and the demo wallet agree on every screen.

const demoCrowd = createDemoCrowd(demoEnergy, () => useUsernameStore.getState().username, DEMO_SEED);
const liveCrowd = isSupabaseConfigured() ? createLiveCrowd(supabaseCrowdPort) : null;

const currentCrowd = () => selectCrowd(useSettingsStore.getState().demoData, demoCrowd, liveCrowd);

export function useCrowd(): CrowdRepositories {
  const demo = useSettingsStore((state) => state.demoData);
  return useMemo(() => selectCrowd(demo, demoCrowd, liveCrowd), [demo]);
}

// Checks in on the server (or the demo), then keeps the countdown on the phone with the server's
// expiry. The check-in earns Energy, so the wallet is read again.
export async function checkIn(routeCode: string, stationCode: string): Promise<CheckInResult> {
  const nowMs = Date.now();
  const result = await currentCrowd().checkins.checkIn(routeCode, stationCode, newRequestKey('checkin', nowMs, Math.random()));
  if (result.ok) {
    useCheckInStore.getState().checkInAt(routeCode, stationCode, nowMs, result.expiresAtMs);
    void refreshEnergy();
  }
  return result;
}

// "I boarded" keeps the ride in My Rides; both end the check-in on the server too
export function endCheckIn(boarded: boolean): void {
  const store = useCheckInStore.getState();
  if (boarded) store.boarded(Date.now());
  else store.clear();
  void currentCrowd().checkins.end();
}

export async function sendReport(input: ReportInput): Promise<ReportResult> {
  const result = await currentCrowd().reports.post(input, newRequestKey('report', Date.now(), Math.random()));
  if (result.ok) void refreshEnergy();
  return result;
}

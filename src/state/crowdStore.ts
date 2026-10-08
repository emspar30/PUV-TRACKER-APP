import { useMemo } from 'react';
import { create } from 'zustand';

import { createDemoCrowd } from '@/data/demo/demoCrowd';
import { createLiveCrowd } from '@/data/live/liveCrowd';
import { selectCrowd, type CrowdRepositories } from '@/data/repositories/select';
import type { CheckInResult, FlagResult, ReportInput, ReportResult } from '@/data/repositories/types';
import { supabaseCrowdPort } from '@/services/crowd';
import { isSupabaseConfigured } from '@/services/supabase';
import { newRequestKey } from '@/shared/backend/rules';
import { DEMO_SEED } from '@/shared/config';

import { useCheckInStore } from './checkinStore';
import { useCountsStore } from './countsStore';
import { demoEnergy, refreshEnergy } from './energyStore';
import { useSettingsStore } from './settingsStore';
import { refreshTrust, useTrustStore } from './trustStore';
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
export async function checkIn(routeCodes: readonly string[], stationCode: string): Promise<CheckInResult> {
  const nowMs = Date.now();
  const result = await currentCrowd().checkins.checkIn(routeCodes, stationCode, newRequestKey('checkin', nowMs, Math.random()));
  if (result.ok) {
    useCheckInStore.getState().checkInAt(routeCodes, stationCode, nowMs, result.expiresAtMs);
    // F5: counted on the phone for the badges
    useCountsStore.getState().addCheckIn();
    void refreshEnergy();
    earnedTrust(nowMs);
  }
  return result;
}

// B7: a check-in or relay earns a trust point (capped a day): counted on the phone in the demo,
// read again from the server on live data
function earnedTrust(atMs: number): void {
  if (useSettingsStore.getState().demoData) useTrustStore.getState().addDemoEvent(atMs);
  else void refreshTrust();
}

// "I boarded" keeps the ride in My Rides; both end the check-in on the server too
export function endCheckIn(boarded: boolean): void {
  const store = useCheckInStore.getState();
  if (boarded) store.boarded(Date.now());
  else store.clear();
  void currentCrowd().checkins.end();
}

// N1: posts this user flagged are hidden for them at once (while the app is open); the server
// hides a post for everyone at FEED_FLAG_HIDE_COUNT flags
export const useFlaggedStore = create<{ ids: ReadonlySet<string>; add: (id: string) => void }>((set) => ({
  ids: new Set(),
  add: (id) => set((state) => ({ ids: new Set([...state.ids, id]) })),
}));

// EQ-7: posts sent from this phone while the app is open, so the feed marks them "You" even when
// the handle on the phone and the one on the account differ
export const useOwnPostsStore = create<{ ids: ReadonlySet<string>; add: (id: string) => void }>((set) => ({
  ids: new Set(),
  add: (id) => set((state) => ({ ids: new Set([...state.ids, id]) })),
}));

export async function flagPost(postId: string, demo: boolean): Promise<FlagResult> {
  // A made-up demo post is only hidden on this phone
  const result: FlagResult = demo ? { ok: true, hidden: false } : await currentCrowd().reports.flag(postId);
  if (result.ok) useFlaggedStore.getState().add(postId);
  return result;
}

export async function sendReport(input: ReportInput): Promise<ReportResult> {
  const nowMs = Date.now();
  const result = await currentCrowd().reports.post(input, newRequestKey('report', nowMs, Math.random()));
  if (result.ok) {
    void refreshEnergy();
    earnedTrust(nowMs);
    useCountsStore.getState().addReport(input.withGps);
    if (result.postId) useOwnPostsStore.getState().add(result.postId);
  }
  return result;
}

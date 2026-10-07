import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { newlyEarned, NO_COUNTS, type BadgeCounts, type BadgeId } from '@/shared/profile/badges';
import { strings } from '@/strings';

import { useRidesStore, type RecentRide } from './ridesStore';
import { showToast } from './toastStore';

// F5: the user's own counts for the badges (PRD 19, D8), kept on this phone only and never sent:
// trips planned on My Rides, check-ins and relays that went through. Counts only, no ranking.

type StoredCounts = BadgeCounts & {
  // The last trip counted, so the same From and To planned again is not counted twice
  lastTripKey: string | null;
};

type CountsState = StoredCounts & {
  addTrip: (key: string) => void;
  addCheckIn: () => void;
  addReport: (withGps: boolean) => void;
};

const deviceStorage = createJSONStorage<StoredCounts>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

// The counts the badges use. Check-ins and relays from before the counts existed are still in the
// ride history, so a badge never shows less than "Your rides" does.
export function badgeCountsOf({ tripsPlanned, checkIns, reports, gpsReports }: BadgeCounts, rides: readonly RecentRide[]): BadgeCounts {
  return {
    tripsPlanned,
    checkIns: Math.max(checkIns, rides.filter((ride) => ride.source === 'checkin').length),
    reports: Math.max(reports, rides.filter((ride) => ride.source === 'report').length),
    gpsReports,
  };
}

const countsOf = (counts: BadgeCounts): BadgeCounts => badgeCountsOf(counts, useRidesStore.getState().rides);

// A short notice for each badge just earned (in-app only)
function announce(ids: BadgeId[]): void {
  ids.forEach((id) => showToast({ title: strings.badges.earned(strings.badges.names[id]) }));
}

export const useCountsStore = create<CountsState>()(
  persist(
    (set, get) => {
      const bump = (change: Partial<BadgeCounts> & { lastTripKey?: string | null }) => {
        const before = countsOf(get());
        set(change);
        announce(newlyEarned(before, countsOf(get())));
      };
      return {
        ...NO_COUNTS,
        lastTripKey: null,
        addTrip: (key) => {
          if (get().lastTripKey === key) return;
          bump({ tripsPlanned: get().tripsPlanned + 1, lastTripKey: key });
        },
        addCheckIn: () => bump({ checkIns: get().checkIns + 1 }),
        addReport: (withGps) => bump({ reports: get().reports + 1, gpsReports: get().gpsReports + (withGps ? 1 : 0) }),
      };
    },
    {
      name: 'badge-counts',
      storage: deviceStorage,
      partialize: ({ tripsPlanned, checkIns, reports, gpsReports, lastTripKey }) => ({ tripsPlanned, checkIns, reports, gpsReports, lastTripKey }),
    },
  ),
);

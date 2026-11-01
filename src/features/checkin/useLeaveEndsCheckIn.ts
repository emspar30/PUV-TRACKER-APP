import { MapPinOff } from 'lucide-react-native';
import { useEffect, useRef } from 'react';

import { useRouteData } from '@/data/RouteDataProvider';
import { placeOf, useCommuterPosition } from '@/features/map/useCommuterPosition';
import { checkLeave } from '@/shared/checkin/leave';
import { endCheckIn } from '@/state/crowdStore';
import { useLocationStore } from '@/state/locationStore';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';

import { useActiveCheckIn } from './useActiveCheckIn';

// CA3 (Emjay, 2026-10-30): a check-in ends by itself once the commuter leaves the stop's range, or
// the spot of a near check-in (shared/checkin/leave), so drivers do not count someone who walked
// off. Each new position is one reading. Foreground only: the position comes from the Map and
// Check-in tabs' location watch; with the app closed, the check-in runs out at its expiry instead.
export function useLeaveEndsCheckIn(): void {
  const checkIn = useActiveCheckIn();
  const { stops } = useRouteData();
  const commuter = useCommuterPosition();
  const fix = useLocationStore((state) => state.fix);
  const stop = checkIn ? stops.find((candidate) => candidate.code === checkIn.stationCode) : undefined;
  // Readings outside in a row, for this check-in
  const outside = useRef<{ checkIn: number; count: number }>({ checkIn: 0, count: 0 });

  useEffect(() => {
    if (!checkIn || !stop) return;
    if (outside.current.checkIn !== checkIn.createdAtMs) outside.current = { checkIn: checkIn.createdAtMs, count: 0 };
    const result = checkLeave(outside.current.count, checkIn, stop, placeOf(commuter, fix, Date.now()));
    outside.current.count = result.outside;
    if (!result.leave) return;
    endCheckIn(false);
    showToast({ icon: MapPinOff, title: strings.checkin.leftTitle, body: strings.checkin.leftBody(checkIn.stationCode) });
  }, [checkIn, stop, commuter, fix]);
}

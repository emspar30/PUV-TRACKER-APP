import { CircleCheck } from 'lucide-react-native';
import { useEffect } from 'react';

import type { BleVehicle } from '@/services/beacon';
import { boardingEndsCheckIn } from '@/shared/checkin/localCheckin';
import { endCheckIn } from '@/state/crowdStore';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';

import { useActiveCheckIn } from './useActiveCheckIn';

// DR8, PRD 7.5 auto-cancel: once Bluetooth has found and the server has verified the multicab, a
// check-in on its route ends as "I boarded" (kept in My Rides), so the driver's heatmap drops at its
// next message.
export function useBoardingEndsCheckIn(vehicle: BleVehicle | null): void {
  const checkIn = useActiveCheckIn();
  useEffect(() => {
    if (!vehicle || !boardingEndsCheckIn(checkIn, vehicle.routeCode, Date.now())) return;
    endCheckIn(true);
    showToast({ icon: CircleCheck, title: strings.checkin.boardedTitle(vehicle.routeCode, vehicle.plate), body: strings.checkin.boardedBody });
  }, [vehicle, checkIn]);
}

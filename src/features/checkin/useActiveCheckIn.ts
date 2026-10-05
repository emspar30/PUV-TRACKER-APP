import { useEffect, useState } from 'react';

import { isActive, type LocalCheckIn } from '@/shared/checkin/localCheckin';
import { useCheckInStore } from '@/state/checkinStore';

// The running check-in, or null once it has ended or expired (B3). Re-renders once, at the expiry,
// instead of ticking every second, so the tab bar can use it cheaply.
export function useActiveCheckIn(): LocalCheckIn | null {
  const checkIn = useCheckInStore((state) => state.checkIn);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!checkIn) return undefined;
    const timer = setTimeout(() => setNowMs(Date.now()), Math.max(0, checkIn.expiresAtMs - Date.now()));
    return () => clearTimeout(timer);
  }, [checkIn]);
  return isActive(checkIn, nowMs) ? checkIn : null;
}

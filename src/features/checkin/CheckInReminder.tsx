import { usePathname } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useEffect, useRef } from 'react';

import { formatCountdown, reminderAtMs, remainingMs } from '@/shared/checkin/localCheckin';
import { CHECKIN_REMINDER_MIN } from '@/shared/config';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';

import { useActiveCheckIn } from './useActiveCheckIn';

const CHECKIN_PATH = '/checkin';

// B3: CHECKIN_REMINDER_MIN into a check-in, an in-app toast reminds the commuter that they are
// still checked in, unless the Check-in tab is in front. Once per check-in; nothing when the app
// was closed at that moment (no system notifications yet). Renders nothing.
export function CheckInReminder() {
  const checkIn = useActiveCheckIn();
  const pathname = usePathname();
  const onCheckIn = useRef(pathname === CHECKIN_PATH);
  useEffect(() => {
    onCheckIn.current = pathname === CHECKIN_PATH;
  }, [pathname]);

  useEffect(() => {
    if (!checkIn) return undefined;
    const atMs = reminderAtMs(checkIn, CHECKIN_REMINDER_MIN);
    const waitMs = atMs === null ? -1 : atMs - Date.now();
    if (waitMs < 0) return undefined;
    const timer = setTimeout(() => {
      if (onCheckIn.current) return;
      showToast({
        icon: Clock,
        title: strings.checkin.reminderTitle(checkIn.stationCode),
        body: strings.checkin.reminderBody(formatCountdown(remainingMs(checkIn, Date.now()))),
      });
    }, waitMs);
    return () => clearTimeout(timer);
  }, [checkIn]);

  return null;
}

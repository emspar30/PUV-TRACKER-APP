import { Bus, CircleCheck } from 'lucide-react-native';
import { useEffect, useRef } from 'react';

import { useRouteData } from '@/data/RouteDataProvider';
import { useRepositories } from '@/data/live/useRepositories';
import { useRoutesVehicles } from '@/features/vehicles/useRoutesVehicles';
import { boardingCandidate, standingAtStop, type StandingSince } from '@/shared/checkin/boarding';
import { formatCountdown, reminderAtMs, remainingMs } from '@/shared/checkin/localCheckin';
import { CHECKIN_REMINDER_MIN } from '@/shared/config';
import { endCheckIn } from '@/state/crowdStore';
import { showDialog } from '@/state/dialogStore';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';

import { useActiveCheckIn } from './useActiveCheckIn';

const NO_ROUTES: readonly string[] = [];

// "Yes" ends the check-in as boarded (kept in My Rides); "Not yet" keeps waiting
function askBoarded(title: string, body: string, boarded: () => void) {
  showDialog({
    tone: 'primary',
    icon: Bus,
    title,
    body,
    actions: [
      {
        label: strings.checkin.boardedYes,
        onPress: () => {
          endCheckIn(true);
          boarded();
        },
      },
      { label: strings.checkin.notYet, variant: 'secondary' },
    ],
  });
}

// B3, CA1.1 (Emjay, 2026-10-22): during a check-in the app asks "Did you board?", on every tab: as
// soon as a Live multicab of a pinged route stands at the stop (each multicab once,
// shared/checkin/boarding), and CHECKIN_REMINDER_MIN into the check-in in any case. In-app only;
// nothing when the app was closed at that moment (no system notifications yet). Renders nothing.
export function CheckInReminder() {
  const checkIn = useActiveCheckIn();
  const { stops } = useRouteData();
  const repos = useRepositories();
  const feed = useRoutesVehicles(repos.vehicles, checkIn?.routeCodes ?? NO_ROUTES, checkIn === null);
  const stop = checkIn ? stops.find((candidate) => candidate.code === checkIn.stationCode) : undefined;
  // The multicabs seen standing at the stop and those already asked about, for this check-in
  const watch = useRef<{ checkIn: number; since: StandingSince; asked: string[] }>({ checkIn: 0, since: {}, asked: [] });

  useEffect(() => {
    if (!checkIn || !stop || feed.nowMs === 0) return;
    if (watch.current.checkIn !== checkIn.createdAtMs) watch.current = { checkIn: checkIn.createdAtMs, since: {}, asked: [] };
    const standing = standingAtStop(feed.vehicles, stop, checkIn.routeCodes, feed.nowMs);
    const { since, ask } = boardingCandidate(standing, watch.current.since, watch.current.asked, feed.nowMs);
    watch.current.since = since;
    if (!ask) return;
    watch.current.asked = [...watch.current.asked, ask.id];
    askBoarded(strings.checkin.boardQuestion(ask.routeCode, ask.label), strings.checkin.boardStopped(ask.routeCode, ask.label, stop.name), () =>
      showToast({ icon: CircleCheck, title: strings.checkin.boardedTitle(ask.routeCode, ask.label), body: strings.checkin.boardedBody }),
    );
  }, [checkIn, stop, feed.vehicles, feed.nowMs]);

  useEffect(() => {
    if (!checkIn) return undefined;
    const atMs = reminderAtMs(checkIn, CHECKIN_REMINDER_MIN);
    const waitMs = atMs === null ? -1 : atMs - Date.now();
    if (waitMs < 0) return undefined;
    const timer = setTimeout(() => {
      askBoarded(
        strings.checkin.reminderTitle(checkIn.stationCode),
        strings.checkin.reminderBody(formatCountdown(remainingMs(checkIn, Date.now()))),
        () => showToast({ icon: CircleCheck, title: strings.checkin.farewellTitle, body: strings.checkin.farewellBody(checkIn.routeCodes.join(', ')) }),
      );
    }, waitMs);
    return () => clearTimeout(timer);
  }, [checkIn]);

  return null;
}

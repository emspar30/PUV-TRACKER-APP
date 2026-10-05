import { CircleCheck, RadioTower } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Vibration } from 'react-native';

import { RELAY_CHECK_S } from '@/shared/config';
import type { LatLon } from '@/shared/geo/haversine';
import { broadcastEnd, type RelayBroadcast } from '@/shared/relay/broadcast';
import { useRelayStore } from '@/state/relayStore';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';

const MS_PER_S = 1000;

// B4: keeps the relay's GPS sharing going until the rider reaches the destination they picked (or
// the time limit), then ends it with a short vibration and a toast. The position is checked as it
// moves; the clock every RELAY_CHECK_S. Returns the running session, or null.
export function useRelayBroadcast(position: LatLon | null): RelayBroadcast | null {
  const session = useRelayStore((store) => store.session);
  const stop = useRelayStore((store) => store.stop);
  const [nowMs, setNowMs] = useState(Date.now);

  useEffect(() => {
    if (!session) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), RELAY_CHECK_S * MS_PER_S);
    return () => clearInterval(timer);
  }, [session]);

  const end = session ? broadcastEnd(session, position, Math.max(nowMs, session.startedMs)) : null;
  useEffect(() => {
    if (!session || !end) return;
    stop();
    Vibration.vibrate();
    showToast(
      end === 'arrived'
        ? { icon: CircleCheck, title: strings.report.arrivedTitle(session.destination.name), body: strings.report.arrivedBody }
        : { icon: RadioTower, title: strings.report.expiredTitle, body: strings.report.expiredBody },
    );
  }, [session, end, stop]);

  return session;
}

import { getBatteryLevelAsync, isLowPowerModeEnabledAsync } from 'expo-battery';
import { useEffect, useRef } from 'react';

import { BATON_HEARTBEAT_S } from '@/shared/config';
import type { LatLon } from '@/shared/geo/haversine';
import type { LineCoordinates } from '@/shared/geo/line';
import { batonEligible } from '@/shared/relay/baton';
import { relayProgress } from '@/shared/relay/progress';
import { relayHeartbeat, relayLeave } from '@/services/baton';
import { useRelayStore } from '@/state/relayStore';
import { fieldLog } from '@/state/fieldLogStore';

const MS_PER_S = 1000;
const PERCENT = 100;

async function batteryState(): Promise<{ pct: number | null; lowPower: boolean }> {
  try {
    const [level, lowPower] = await Promise.all([getBatteryLevelAsync(), isLowPowerModeEnabledAsync()]);
    return { pct: level < 0 ? null : Math.round(level * PERCENT), lowPower };
  } catch {
    return { pct: null, lowPower: false };
  }
}

// BT1 (PRD 8.3): while a team rider relays a multicab on the live map, a heartbeat every
// BATON_HEARTBEAT_S tells the server how far they still ride and whether they may lead (battery,
// battery saver, location); the answer is their role. A Secondary sends no positions
// (useGpsBroadcast); the relay bar says who is sharing. The rider leaves when the relay ends.
export function useRelayBaton(position: LatLon | null, lines: readonly LineCoordinates[], teamLive: boolean): void {
  const session = useRelayStore((store) => store.session);
  const positionRef = useRef(position);
  const linesRef = useRef(lines);
  // The drop-off when the rider joined; another one later sends them to the back of the queue
  const joinedStop = useRef<string | null>(null);
  useEffect(() => {
    positionRef.current = position;
    linesRef.current = lines;
  }, [position, lines]);
  const vehicleId = session?.mode === 'live' && teamLive && session.demo !== true ? session.vehicleId : null;

  useEffect(() => {
    if (!session || !vehicleId) return undefined;
    let cancelled = false;
    joinedStop.current ??= session.destination.code;
    const beat = async () => {
      const { pct, lowPower } = await batteryState();
      const watch = useRelayStore.getState().watch;
      const progress = relayProgress({ session, position: positionRef.current, lines: linesRef.current, speedKmh: null, capFromMs: watch.capFromMs, nowMs: Date.now() });
      const changed = joinedStop.current !== session.destination.code;
      const role = await relayHeartbeat(vehicleId, progress.leftM ?? 0, batonEligible(pct, lowPower, positionRef.current !== null), changed);
      if (!cancelled && role && useRelayStore.getState().session === session) {
        // S10: a role change (a handoff to this phone is secondary, then primary)
        if (useRelayStore.getState().baton !== role) fieldLog(role);
        useRelayStore.getState().setBaton(role);
      }
    };
    void beat();
    const timer = setInterval(() => void beat(), BATON_HEARTBEAT_S * MS_PER_S);
    return () => {
      cancelled = true;
      clearInterval(timer);
      void relayLeave(vehicleId);
      if (useRelayStore.getState().session === null) joinedStop.current = null;
    };
  }, [session, vehicleId]);
}

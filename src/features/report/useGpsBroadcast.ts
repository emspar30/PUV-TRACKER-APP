import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { drainOutbox, pushOutbox } from '@/data/db/telemetryOutbox';
import { getLocalDb } from '@/data/RouteDataProvider';
import { sendTelemetryBatch } from '@/services/telemetry';
import type { RelayBroadcast } from '@/shared/relay/broadcast';
import { retryDelayS } from '@/shared/telemetry/outbox';
import type { TelemetryPacket } from '@/shared/telemetry/packet';
import { nextPacket, type BroadcastFix } from '@/shared/telemetry/sendRule';
import { useLocationStore } from '@/state/locationStore';

const MS_PER_S = 1000;

// What the relay bar says about the marker
export type UplinkStatus =
  // The relay has no multicab picked, so no marker moves
  | { kind: 'noVehicle' }
  // Not a team account: live markers are for the team only (PRD 0.7), so nothing is sent
  | { kind: 'offTeam' }
  // No position good enough to send yet
  | { kind: 'waiting' }
  // The server has the newest position
  | { kind: 'live'; sentMs: number }
  // Positions kept on the phone until the network is back
  | { kind: 'saved'; count: number };

// T1: foreground GPS broadcasting (PRD 8.4). While a relay with GPS and a picked multicab runs, a
// team account's fixes become packets by the send rule (shared/telemetry/sendRule), each stored in
// the phone's buffer and sent from there as one batch. A failed send keeps the buffer and tries again
// later (retryDelayS); the buffer is also sent at start and on return to the app, so a
// relay that ended in a dead zone still arrives. Nothing is sent while the app is in the background.
export function useGpsBroadcast(session: RelayBroadcast | null, teamAccount: boolean): UplinkStatus {
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [saved, setSaved] = useState(0);
  const [failing, setFailing] = useState(false);
  // When the server last took a position, and for which relay (by its start)
  const [sent, setSent] = useState<{ startedMs: number | null; atMs: number } | null>(null);
  // The last packet made, and the relay it belongs to: a new relay sends its first good fix at once
  const lastPacket = useRef<{ startedMs: number; packet: TelemetryPacket } | null>(null);
  const startedRef = useRef<number | null>(null);
  const flushing = useRef(false);
  const flushAgain = useRef(false);
  const failures = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  const flush = useCallback(async () => {
    const db = getLocalDb();
    if (!teamAccount || !db) return;
    if (flushing.current) {
      flushAgain.current = true;
      return;
    }
    flushing.current = true;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
    flushAgain.current = false;
    try {
      // Equal to batch by batch: any batch leaving the buffer resets the failures, a failure counts one
      const drained = await drainOutbox(db, sendTelemetryBatch, Date.now);
      if (drained.progressed) {
        failures.current = 0;
        setFailing(false);
      }
      if (drained.sentAtMs !== null) setSent({ startedMs: startedRef.current, atMs: drained.sentAtMs });
      if (drained.retry) {
        failures.current += 1;
        setFailing(true);
        retryTimer.current = setTimeout(() => void flushRef.current(), retryDelayS(failures.current) * MS_PER_S);
      }
      setSaved(drained.remaining);
    } catch {
      // The local database is closing (a reload); the buffer is read again next time
    } finally {
      flushing.current = false;
    }
    if (flushAgain.current && !retryTimer.current) void flushRef.current();
  }, [teamAccount]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Send what is left in the buffer at start and whenever the app comes back to the foreground.
  // Through the ref (set by the effect above, which runs first), as the retry timer does
  useEffect(() => {
    void flushRef.current();
    const subscription = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      if (state === 'active') void flush();
    });
    return () => {
      subscription.remove();
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = null;
    };
  }, [flush]);

  const vehicleId = session?.vehicleId ?? null;
  const seatTier = session?.seatTier ?? null;
  const startedMs = session?.startedMs ?? null;
  const broadcasting = active && teamAccount && vehicleId !== null && seatTier !== null;

  useEffect(() => {
    startedRef.current = startedMs;
  }, [startedMs]);

  useEffect(() => {
    if (!broadcasting || !vehicleId || !seatTier || startedMs === null) return undefined;
    const onFix = (fix: BroadcastFix | null) => {
      const db = getLocalDb();
      if (!fix || !db) return;
      const nowMs = Date.now();
      const last = lastPacket.current?.startedMs === startedMs ? lastPacket.current.packet : null;
      const packet = nextPacket(last, fix, { vehicleId, seatTier }, nowMs);
      if (!packet) return;
      lastPacket.current = { startedMs, packet };
      pushOutbox(db, packet, nowMs)
        .then(() => flush())
        .catch(() => {
          // The local database is closing; this position is lost, the next one is not
        });
    };
    onFix(useLocationStore.getState().fix);
    return useLocationStore.subscribe((state, previous) => {
      if (state.fix !== previous.fix) onFix(state.fix);
    });
  }, [broadcasting, vehicleId, seatTier, startedMs, flush]);

  if (!teamAccount) return { kind: 'offTeam' };
  if (!vehicleId) return { kind: 'noVehicle' };
  if (failing && saved > 0) return { kind: 'saved', count: saved };
  if (sent && sent.startedMs === startedMs) return { kind: 'live', sentMs: sent.atMs };
  return { kind: 'waiting' };
}

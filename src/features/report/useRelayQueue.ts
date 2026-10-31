import { RadioTower } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Vibration } from 'react-native';

import type { VehiclesRepository } from '@/data/repositories/types';
import { useRouteData } from '@/data/RouteDataProvider';
import { useRoutesVehicles } from '@/features/vehicles/useRoutesVehicles';
import { RELAY_QUEUE_BEACON_GONE_S, RELAY_QUEUE_MAX_MIN, RELAY_QUEUE_TICK_S, RELAY_SAME_VEHICLE_GAP_H } from '@/shared/config';
import type { LatLon } from '@/shared/geo/haversine';
import type { LineCoordinates } from '@/shared/geo/line';
import { relayStopCode } from '@/shared/relay/broadcast';
import { queueStep, type QueueBeacons, type QueueEnd } from '@/shared/relay/queue';
import { sendReport } from '@/state/crowdStore';
import { useRecentRelaysStore } from '@/state/recentRelaysStore';
import { useRelayFormStore } from '@/state/relayFormStore';
import { useBackgroundRelayStore } from '@/state/backgroundRelayStore';
import { useRelayStore, type QueuedRelay } from '@/state/relayStore';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';

import { useBleVehicle, useForeground, type BleState } from './useBleVehicle';

const MS_PER_S = 1000;
const NO_ROUTES: readonly string[] = [];

function beaconsOf(view: BleState['view']): QueueBeacons {
  switch (view?.kind) {
    case 'found':
      return { kind: 'one', vehicle: view.vehicle };
    case 'ambiguous':
      return { kind: 'several' };
    default:
      return { kind: 'none' };
  }
}

function endText(reason: QueueEnd): string {
  const ended = strings.report.queue.ended;
  switch (reason) {
    case 'walked_away':
      return ended.walked_away(RELAY_QUEUE_BEACON_GONE_S);
    case 'timed_out':
      return ended.timed_out(RELAY_QUEUE_MAX_MIN);
    case 'same_vehicle':
      return ended.same_vehicle(RELAY_SAME_VEHICLE_GAP_H);
    case 'location_off':
    case 'other_route':
      return ended[reason]();
  }
}

// RL2c (D12): runs a queued relay (shared/relay/queue) until it is released or ends. Live data: a
// Bluetooth scan that drops a multicab it no longer hears, while the app is in front (until B1).
// Demo data has no beacons: the rider is taken to be in the demo multicab picked in the form, so its
// position stands in for the rider's, and it is heard while the demo shows it. On release the relay
// is sent with that multicab (and its newest beacon code) and the relay session starts; each end
// comes with a vibration and a toast.
export function useRelayQueue(position: LatLon | null, lines: readonly LineCoordinates[], vehicles: VehiclesRepository): QueuedRelay | null {
  const queued = useRelayStore((store) => store.queued);
  const formOpen = useRelayFormStore((store) => store.open);
  const [nowMs, setNowMs] = useState(Date.now);
  const releasing = useRef(false);
  const { stops } = useRouteData();
  const demo = queued?.demo === true;

  // B1: in the background the queue runs only with the background relay; otherwise it pauses
  const backgroundOn = useBackgroundRelayStore((store) => store.running);
  const foreground = useForeground();
  const paused = !foreground && !backgroundOn;
  // The form's own scan stops as it closes; this one starts after, so the two never overlap
  const ble = useBleVehicle(queued !== null && !demo && !formOpen, { sticky: false, durationMin: RELAY_QUEUE_MAX_MIN, background: backgroundOn });
  const fleet = useMemo<VehiclesRepository>(() => (vehicles.subscribeAll ? { ...vehicles, subscribe: vehicles.subscribeAll } : vehicles), [vehicles]);
  const demoRoutes = useMemo(() => (queued && demo ? [queued.queue.routeCode] : NO_ROUTES), [queued, demo]);
  const demoFleet = useRoutesVehicles(fleet, demoRoutes, !demo);
  const demoVehicle = demo ? demoFleet.vehicles.find((vehicle) => vehicle.id === queued?.vehicleId && !vehicle.hidden) : undefined;

  useEffect(() => {
    if (!queued) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), RELAY_QUEUE_TICK_S * MS_PER_S);
    return () => clearInterval(timer);
  }, [queued]);

  const demoId = demoVehicle?.id ?? null;
  const demoRoute = demoVehicle?.routeCode ?? null;
  const demoPlate = demoVehicle?.label ?? null;
  const demoLat = demoVehicle?.lat ?? null;
  const demoLon = demoVehicle?.lon ?? null;
  const bleView = ble.view;
  const beacons = useMemo<QueueBeacons>(() => {
    if (!demo) return beaconsOf(bleView);
    return demoId && demoRoute && demoPlate ? { kind: 'one', vehicle: { routeCode: demoRoute, vehicleId: demoId, plate: demoPlate } } : { kind: 'none' };
  }, [demo, bleView, demoId, demoRoute, demoPlate]);
  // In the demo the rider rides in the demo multicab
  const rider = useMemo<LatLon | null>(() => (demo && demoLat !== null && demoLon !== null ? { lat: demoLat, lon: demoLon } : position), [demo, demoLat, demoLon, position]);
  const payloadHex = bleView?.kind === 'found' ? bleView.payloadHex : null;

  useEffect(() => {
    if (!queued || releasing.current) return;
    // Paused: the time away does not count as walking away
    if (paused) {
      if (nowMs > queued.queue.lastHeardMs) useRelayStore.getState().setQueue({ ...queued.queue, lastHeardMs: nowMs });
      return;
    }
    const step = queueStep(queued.queue, {
      beacons,
      position: rider,
      lines,
      nowMs: Math.max(nowMs, queued.queue.startedMs),
      recentRelays: useRecentRelaysStore.getState().relays,
    });
    const store = useRelayStore.getState();
    if (step.kind === 'waiting') {
      if (step.queue.lastHeardMs !== queued.queue.lastHeardMs) store.setQueue(step.queue);
      return;
    }
    if (step.kind === 'ended') {
      store.dequeue();
      Vibration.vibrate();
      showToast({ inbox: true, icon: RadioTower, title: strings.report.queue.endedTitle, body: endText(step.reason) });
      return;
    }
    releasing.current = true;
    const { vehicle } = step;
    // D11: the stop nearest the rider when the relay is released, as a code only
    const stopCode = relayStopCode(stops, rider);
    void sendReport({ ...queued.input, stopCode, routeCode: vehicle.routeCode, vehicleId: vehicle.vehicleId, beaconHex: demo ? null : payloadHex })
      .then((result) => {
        if (useRelayStore.getState().queued !== queued) return;
        if (result.ok) {
          useRelayStore.getState().start({
            ...queued.session,
            post: result.postId ? { id: result.postId, demo } : null,
            routeCode: vehicle.routeCode,
            vehicleId: vehicle.vehicleId,
            startedMs: Date.now(),
          });
          Vibration.vibrate();
          showToast({
            inbox: true,
            icon: RadioTower,
            title: strings.report.queue.releasedTitle(vehicle.plate),
            body: queued.session.mode === 'live' ? strings.report.sentBodyGps(queued.session.destination.name) : strings.report.sentBodyFeed(queued.session.destination.name),
          });
          return;
        }
        useRelayStore.getState().dequeue();
        const body =
          result.reason === 'same_vehicle'
            ? strings.report.sameVehicle
            : result.reason === 'no_beacon'
              ? strings.report.gate.noBeacon
              : result.reason === 'no_username'
                ? strings.report.noUsername
                : ('message' in result ? result.message : undefined) ?? strings.report.failedBody;
        showToast({ inbox: true, icon: RadioTower, title: strings.report.failedTitle, body });
      })
      .finally(() => {
        releasing.current = false;
      });
    // The step is worked out again on each tick, beacon or position change
  }, [queued, beacons, rider, lines, nowMs, demo, payloadHex, stops, paused]);

  return queued;
}

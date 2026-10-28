import { TrackingLayers } from '@/features/tracking/TrackingLayers';

import { BlueDot } from './BlueDot';
import type { CommuterPosition } from './useCommuterPosition';

// Where the commuter is, as on the Map tab: the blue dot for a GPS fix, and the "You" pin for a
// simulated stop or a pinned spot (Emjay, 2026-10-25: Check-in and My Rides show it too, so the
// rider can see how far the stop is). Rendered inside a map.
export function YouLayers({ commuter, labels }: { commuter: CommuterPosition | null; labels: boolean }) {
  return (
    <>
      {commuter && commuter.source !== 'gps' ? <TrackingLayers commuter={commuter} vehicle={null} line={null} labels={labels} /> : null}
      <BlueDot />
    </>
  );
}

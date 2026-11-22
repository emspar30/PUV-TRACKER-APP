// Background alerts (owner, 2026-11-23): while the rider tracks a multicab or is checked in, a
// location foreground service (with its own notice) keeps Tunton running in other apps and with the
// screen off, so the track alerts and "Did you board?" reach the notification shade. A relay has its
// own service already, so this one stands down while a relay is queued or running. Pure.

export type BackgroundWatch = { kind: 'tracking'; routeCode: string } | { kind: 'checkin'; stationCode: string } | null;

export function backgroundWatch(state: { relaying: boolean; trackedRoute: string | null; checkInStation: string | null }): BackgroundWatch {
  if (state.relaying) return null;
  if (state.trackedRoute !== null) return { kind: 'tracking', routeCode: state.trackedRoute };
  if (state.checkInStation !== null) return { kind: 'checkin', stationCode: state.checkInStation };
  return null;
}

// Same watch, same notice: the service restarts only when this changes
export function watchKey(watch: BackgroundWatch): string | null {
  if (watch === null) return null;
  return watch.kind === 'tracking' ? `tracking:${watch.routeCode}` : `checkin:${watch.stationCode}`;
}

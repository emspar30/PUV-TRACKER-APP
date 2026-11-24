import { BEACON_DIP_GRACE_S, BEACON_LOST_S, BEACON_PRESENCE_S, RSSI_MARGIN_DB, RSSI_PRESENCE_THRESHOLD_DBM } from '../config';
import { smoothRssi } from '../rssi/ema';

// Which multicab's beacon the commuter is in (PRD 10.1; DR8). Each beacon heard gets a track: its
// smoothed signal (PRD 12.4), since when that has stayed above the threshold, and when it was last
// heard. A beacon is present after BEACON_PRESENCE_S above the threshold; of two present beacons the
// stronger wins only by RSSI_MARGIN_DB or more, otherwise the case is ambiguous and the rider picks
// (the Smart Queue of PRD 10.1 comes with verification, V1). 2026-11-24: a dip under the threshold
// of up to BEACON_DIP_GRACE_S keeps the count going instead of starting it again.

const MS_PER_S = 1000;

export type BeaconTrack = {
  smoothedDbm: number;
  // When the smoothed signal last rose above the threshold, or null while it is below (past a short dip)
  aboveSinceMs: number | null;
  lastHeardMs: number;
  // When a short dip under the threshold began, while it lasts; null or absent when above
  belowSinceMs?: number | null;
};

export type BeaconPick<K> = { kind: 'one'; key: K } | { kind: 'ambiguous'; keys: K[] } | { kind: 'none' };

export function updateBeacon(track: BeaconTrack | undefined, rssiDbm: number, atMs: number): BeaconTrack {
  // A beacon heard again after it was lost starts over
  const previous = track && !isLost(track, atMs) ? track : undefined;
  const smoothedDbm = smoothRssi(previous?.smoothedDbm ?? null, rssiDbm);
  const above = smoothedDbm > RSSI_PRESENCE_THRESHOLD_DBM;
  if (above) return { smoothedDbm, aboveSinceMs: previous?.aboveSinceMs ?? atMs, lastHeardMs: atMs, belowSinceMs: null };
  const belowSinceMs = previous?.belowSinceMs ?? atMs;
  const shortDip = previous?.aboveSinceMs != null && atMs - belowSinceMs <= BEACON_DIP_GRACE_S * MS_PER_S;
  return shortDip
    ? { smoothedDbm, aboveSinceMs: previous.aboveSinceMs, lastHeardMs: atMs, belowSinceMs }
    : { smoothedDbm, aboveSinceMs: null, lastHeardMs: atMs, belowSinceMs: null };
}

function inLongDip(track: BeaconTrack, nowMs: number): boolean {
  return track.belowSinceMs != null && nowMs - track.belowSinceMs > BEACON_DIP_GRACE_S * MS_PER_S;
}

function isLost(track: BeaconTrack, nowMs: number): boolean {
  return nowMs - track.lastHeardMs > BEACON_LOST_S * MS_PER_S;
}

export function isPresent(track: BeaconTrack, nowMs: number): boolean {
  return (
    track.aboveSinceMs !== null && !isLost(track, nowMs) && !inLongDip(track, nowMs) && nowMs - track.aboveSinceMs >= BEACON_PRESENCE_S * MS_PER_S
  );
}

export function pickBeacon<K>(tracks: ReadonlyMap<K, BeaconTrack>, nowMs: number): BeaconPick<K> {
  const present = [...tracks.entries()]
    .filter(([, track]) => isPresent(track, nowMs))
    .sort(([, a], [, b]) => b.smoothedDbm - a.smoothedDbm);
  if (present.length === 0) return { kind: 'none' };
  const [[strongest, first], second] = present;
  if (!second || first.smoothedDbm - second[1].smoothedDbm >= RSSI_MARGIN_DB) return { kind: 'one', key: strongest };
  // Every beacon within the margin of the strongest is a candidate
  const keys = present.filter(([, track]) => first.smoothedDbm - track.smoothedDbm < RSSI_MARGIN_DB).map(([key]) => key);
  return { kind: 'ambiguous', keys };
}

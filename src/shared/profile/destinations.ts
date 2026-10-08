// The commuter's frequent destinations (PRD 19, D4). They are kept on the phone only: home or
// work places are sensitive, so no network or upload code may read them.

import { FREQUENT_DESTINATIONS_MAX, ROUTE_STOP_MAX_DISTANCE_M } from '../config';
import { haversineMeters } from '../geo/haversine';

export type Destination = {
  // A landmark id, or a generated id for a point tapped on the map (F3)
  id: string;
  // Short label for a chip
  label: string;
  lat: number;
  lon: number;
};

export type AddResult = 'added' | 'duplicate' | 'full';

export function addDestination(
  list: readonly Destination[],
  item: Destination,
): { list: readonly Destination[]; result: AddResult } {
  if (list.some((existing) => existing.id === item.id)) return { list, result: 'duplicate' };
  if (list.length >= FREQUENT_DESTINATIONS_MAX) return { list, result: 'full' };
  return { list: [...list, item], result: 'added' };
}

export function removeDestination(list: readonly Destination[], id: string): readonly Destination[] {
  return list.filter((item) => item.id !== id);
}

// Accepts only well-formed entries, up to the limit; used when reading a stored list back
export function cleanDestinations(value: unknown): Destination[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter(
    (item): item is Destination =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.label === 'string' &&
      Number.isFinite(item.lat) &&
      Number.isFinite(item.lon),
  );
  const unique = valid.filter((item, index) => valid.findIndex((other) => other.id === item.id) === index);
  return unique.slice(0, FREQUENT_DESTINATIONS_MAX);
}

// EQ-16: a place saved as a landmark that the current route data no longer has (RR3 replaced the
// placeholder stops). Within ROUTE_STOP_MAX_DISTANCE_M of a current landmark it becomes that
// landmark; otherwise it stays where it is as a map point (pointId), labelled from the nearest
// landmark (pointLabel). Map points and known landmarks are left as they are.
export function refreshSavedLandmarks(
  list: readonly Destination[],
  landmarks: readonly Destination[],
  isLandmarkId: (id: string) => boolean,
  pointId: (place: Destination) => string,
  pointLabel: (nearestLabel: string) => string,
): Destination[] {
  const refreshed = list.map((place) => {
    if (!isLandmarkId(place.id) || landmarks.some((landmark) => landmark.id === place.id)) return place;
    const nearest = landmarks
      .map((landmark) => ({ landmark, distanceM: haversineMeters(place, landmark) }))
      .sort((a, b) => a.distanceM - b.distanceM)[0];
    if (!nearest) return place;
    if (nearest.distanceM <= ROUTE_STOP_MAX_DISTANCE_M) {
      const { id, label, lat, lon } = nearest.landmark;
      return { id, label, lat, lon };
    }
    return { ...place, id: pointId(place), label: pointLabel(nearest.landmark.label) };
  });
  return cleanDestinations(refreshed);
}

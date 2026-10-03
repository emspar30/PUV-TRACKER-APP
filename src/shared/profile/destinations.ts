// The commuter's frequent destinations (PRD 19, D4). They are kept on the phone only: home or
// work places are sensitive, so no network or upload code may read them.

import { FREQUENT_DESTINATIONS_MAX } from '../config';

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

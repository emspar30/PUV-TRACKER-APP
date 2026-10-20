// CA1: a place named in a question, found among the places on the phone (stops, saved places and
// the offline map's 1,683 named places) with the same search as My Rides. A clear match is used as
// it is; a name that fits several places equally well becomes "Did you mean" with a few choices.
// Pure: no React Native or Expo imports.

import { ASSISTANT_CHOICES_MAX, ASSISTANT_SEARCH_LIMIT } from '../config';
import { normalizeSearch, rankPlaces, type SearchablePlace } from '../routing/placeSearch';

import type { PlaceSlot } from './intent';

export type Resolved =
  | { kind: 'found'; place: SearchablePlace }
  | { kind: 'choose'; options: SearchablePlace[] }
  | { kind: 'none'; text: string };

// Stops and the user's own places are what a commuter usually means by a short name
const PREFERRED: readonly SearchablePlace['kind'][] = ['saved', 'stop'];

export function resolvePlace(slot: PlaceSlot, places: readonly SearchablePlace[]): Resolved {
  if ('placeId' in slot) {
    const place = places.find((candidate) => candidate.id === slot.placeId);
    return place ? { kind: 'found', place } : { kind: 'none', text: slot.title };
  }
  const query = normalizeSearch(slot.text);
  const ranked = rankPlaces(slot.text, places, ASSISTANT_SEARCH_LIMIT);
  const [first, second] = ranked;
  if (!first) return { kind: 'none', text: slot.text };
  const exact = ranked.filter(
    ({ place }) => normalizeSearch(place.title) === query || (place.code !== undefined && normalizeSearch(place.code) === query),
  );
  if (exact.length === 1) return { kind: 'found', place: exact[0].place };
  if (
    !second ||
    first.rank < second.rank ||
    (PREFERRED.includes(first.place.kind) && !PREFERRED.includes(second.place.kind))
  ) {
    return { kind: 'found', place: first.place };
  }
  return { kind: 'choose', options: ranked.slice(0, ASSISTANT_CHOICES_MAX).map((item) => item.place) };
}

// CA1: a place named in a question, found among the places on the phone (stops, saved places and
// the offline map's 1,683 named places) with the same search as My Rides. CA1.1: the best match is
// always answered at once, never only asked about; a name typed in part or with a typo says which
// place it was taken as, and places that fit as well are offered as "Did you mean" chips. When no
// name starts with what was typed, a few typing mistakes are allowed ("ampayun", "robnson").
// Pure: no React Native or Expo imports.

import { ASSISTANT_CHOICES_MAX, ASSISTANT_SEARCH_LIMIT } from '../config';
import { fuzzyPlaces, normalizeSearch, rankPlaces, type SearchablePlace } from '../routing/placeSearch';

import type { PlaceSlot } from './intent';

// exact: the name or code as typed (or a place picked from a chip); partial: a name that starts with
// what was typed ("sm" for SM City Butuan); corrected: found despite typing mistakes
export type MatchHow = 'exact' | 'partial' | 'corrected';

export type Resolved =
  | { kind: 'found'; place: SearchablePlace; how: MatchHow; others: SearchablePlace[] }
  | { kind: 'none'; text: string };

// The places after the first, one per name, at most ASSISTANT_CHOICES_MAX - 1
function runnersUp(first: SearchablePlace, rest: readonly SearchablePlace[]): SearchablePlace[] {
  const seen = new Set([normalizeSearch(first.title)]);
  const others: SearchablePlace[] = [];
  for (const place of rest) {
    const name = normalizeSearch(place.title);
    if (seen.has(name)) continue;
    seen.add(name);
    others.push(place);
    if (others.length >= ASSISTANT_CHOICES_MAX - 1) break;
  }
  return others;
}

export function resolvePlace(slot: PlaceSlot, places: readonly SearchablePlace[]): Resolved {
  if ('placeId' in slot) {
    const place = places.find((candidate) => candidate.id === slot.placeId);
    return place ? { kind: 'found', place, how: 'exact', others: [] } : { kind: 'none', text: slot.title };
  }
  const query = normalizeSearch(slot.text);
  const ranked = rankPlaces(slot.text, places, ASSISTANT_SEARCH_LIMIT);
  const [first] = ranked;
  if (first) {
    const isExact = (place: SearchablePlace) =>
      normalizeSearch(place.title) === query || (place.code !== undefined && normalizeSearch(place.code) === query);
    // The name or code as typed; with several (the Ampayon stop and barangay) the first as ranked, a
    // stop or a saved place before a map place
    const exact = ranked.find(({ place }) => isExact(place));
    if (exact) return { kind: 'found', place: exact.place, how: 'exact', others: [] };
    // Places that fit as well as the best are offered; a worse fit (a later rank) is not
    const even = ranked.filter((item) => item !== first && item.rank === first.rank).map((item) => item.place);
    return { kind: 'found', place: first.place, how: 'partial', others: runnersUp(first.place, even) };
  }
  const fuzzy = fuzzyPlaces(slot.text, places, ASSISTANT_SEARCH_LIMIT);
  const [closest] = fuzzy;
  if (!closest) return { kind: 'none', text: slot.text };
  const even = fuzzy.filter((item) => item !== closest && item.edits === closest.edits).map((item) => item.place);
  return { kind: 'found', place: closest.place, how: 'corrected', others: runnersUp(closest.place, even) };
}

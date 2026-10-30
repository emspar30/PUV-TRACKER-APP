// CA1: a place named in a question, found among the places on the phone (stops, saved places and
// the offline map's 1,683 named places) with the same search as My Rides. CA1.1: the best match is
// answered at once; a name typed in part or with a typo says which place it was taken as, and places
// that fit as well are offered as "Did you mean" chips. A name typed in part that fits several
// different places as well ("robinsons") is asked about first ('ask'). When no
// name starts with what was typed, a few typing mistakes are allowed ("ampayun", "robnson").
// Pure: no React Native or Expo imports.

import { ASSISTANT_ASK_CHOICES_MAX, ASSISTANT_CHOICES_MAX, ASSISTANT_SAME_PLACE_M, ASSISTANT_SEARCH_LIMIT } from '../config';
import { haversineMeters } from '../geo/haversine';
import { fuzzyPlaces, normalizeSearch, rankPlaces, type SearchablePlace } from '../routing/placeSearch';

import type { PlaceSlot } from './intent';

// exact: the name or code as typed (or a place picked from a chip); partial: a name that starts with
// what was typed ("sm" for SM City Butuan); corrected: found despite typing mistakes
export type MatchHow = 'exact' | 'partial' | 'corrected';

export type Resolved =
  | { kind: 'found'; place: SearchablePlace; how: MatchHow; others: SearchablePlace[] }
  | { kind: 'ask'; text: string; choices: SearchablePlace[] }
  | { kind: 'none'; text: string };

// The places after the first, one per name, none within ASSISTANT_SAME_PLACE_M of one already kept
// and none named as a kept one plus more ("SM City Butuan 2"): the mall and its own entrances give
// the same answer. At most `max` - 1.
function runnersUp(first: SearchablePlace, rest: readonly SearchablePlace[], max = ASSISTANT_CHOICES_MAX): SearchablePlace[] {
  const seen = new Set([normalizeSearch(first.title)]);
  const others: SearchablePlace[] = [];
  for (const place of rest) {
    const name = normalizeSearch(place.title);
    if (seen.has(name)) continue;
    const kept = [first, ...others];
    if (kept.some((one) => haversineMeters(one, place) < ASSISTANT_SAME_PLACE_M || name.startsWith(`${normalizeSearch(one.title)} `))) continue;
    seen.add(name);
    others.push(place);
    if (others.length >= max - 1) break;
  }
  return others;
}

// Every word typed is a whole word of the name
function hasWholeWords(query: string, title: string): boolean {
  const words = new Set(normalizeSearch(title).split(' '));
  return query.split(' ').every((word) => words.has(word));
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
    // Places that fit as well as the best are asked about; a worse fit (a later rank) is not, nor,
    // when the words typed are whole words of the best's name ("sm"), a name they only start ("Smart")
    const whole = hasWholeWords(query, first.place.title);
    const even = ranked
      .filter((item) => item !== first && item.rank === first.rank && (!whole || hasWholeWords(query, item.place.title)))
      .map((item) => item.place);
    const choices = runnersUp(first.place, even, ASSISTANT_ASK_CHOICES_MAX);
    if (choices.length > 0) return { kind: 'ask', text: slot.text, choices: [first.place, ...choices] };
    return { kind: 'found', place: first.place, how: 'partial', others: [] };
  }
  const fuzzy = fuzzyPlaces(slot.text, places, ASSISTANT_SEARCH_LIMIT);
  const [closest] = fuzzy;
  if (!closest) return { kind: 'none', text: slot.text };
  const even = fuzzy.filter((item) => item !== closest && item.edits === closest.edits).map((item) => item.place);
  return { kind: 'found', place: closest.place, how: 'corrected', others: runnersUp(closest.place, even) };
}

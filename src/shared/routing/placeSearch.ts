// ST2-C2: typed search for From and To in My Rides, over what is already on the phone: the stops, the
// user's saved places and (ST2-C3) the named places of the offline map: buildings, barangays and
// streets. No network. Case, accents and punctuation are ignored, and a word may be typed in part
// ("doc" finds Butuan Doctors' Hospital).

import { ASSISTANT_FUZZY_MAX_EDITS, ASSISTANT_FUZZY_MIN_CHARS, ASSISTANT_FUZZY_SHORT_CHARS } from '../config';

export type SearchablePlace = {
  id: string;
  title: string;
  // A stop's code (BAN, SMB); none for other places
  code?: string;
  lat: number;
  lon: number;
  kind: SearchKind;
  // ST2-C3: a map place's own kind (school, bank, street ...) and the barangay it is near
  category?: string;
  near?: string;
};

// ST2-C3: among matches of the same rank, the user's places first, then stops, barangays, buildings
// and streets
export type SearchKind = 'saved' | 'stop' | 'area' | 'poi' | 'street';
const KIND_ORDER: readonly SearchKind[] = ['saved', 'stop', 'area', 'poi', 'street'];

// Lower rank first: the code typed in full, the name's start, a word's start, every typed word
// starting a word of the name, then the letters anywhere in the name
const RANK_CODE = 0;
const RANK_NAME_START = 1;
const RANK_WORD_START = 2;
const RANK_ALL_WORDS = 3;
const RANK_ANYWHERE = 4;

// Names are normalised once and kept: the search runs on every typed letter over some 1,700 places
const normalized = new Map<string, string>();

export function normalizeSearch(text: string): string {
  const known = normalized.get(text);
  if (known !== undefined) return known;
  const result = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  normalized.set(text, result);
  return result;
}

function rankOf(query: string, place: SearchablePlace): number | null {
  const name = normalizeSearch(place.title);
  const code = place.code ? normalizeSearch(place.code) : '';
  if (code && code === query) return RANK_CODE;
  if (name.startsWith(query)) return RANK_NAME_START;
  const words = name.split(' ');
  if (words.some((word) => word.startsWith(query))) return RANK_WORD_START;
  const typed = query.split(' ');
  if (typed.length > 1 && typed.every((part) => words.some((word) => word.startsWith(part)))) return RANK_ALL_WORDS;
  if (name.replace(/ /g, '').includes(query.replace(/ /g, ''))) return RANK_ANYWHERE;
  if (code && code.startsWith(query)) return RANK_WORD_START;
  return null;
}

export type RankedPlace = { place: SearchablePlace; rank: number };

// The best matches with their rank (lower is closer), at most `limit`, by rank, then kind
// (KIND_ORDER), then name. CA1: the assistant reads the ranks to tell a clear match from a guess.
export function rankPlaces(query: string, places: readonly SearchablePlace[], limit: number): RankedPlace[] {
  const needle = normalizeSearch(query);
  if (needle.length === 0) return [];
  return places
    .map((place) => ({ place, rank: rankOf(needle, place) }))
    .filter((item): item is RankedPlace => item.rank !== null)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        KIND_ORDER.indexOf(a.place.kind) - KIND_ORDER.indexOf(b.place.kind) ||
        a.place.title.localeCompare(b.place.title),
    )
    .slice(0, limit);
}

// The best matches, at most `limit`, in the order of rankPlaces
export function searchPlaces(query: string, places: readonly SearchablePlace[], limit: number): SearchablePlace[] {
  return rankPlaces(query, places, limit).map((item) => item.place);
}

// CA1.1: the number of letters to insert, remove or change to turn one word into the other
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_v, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const change = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, change));
    }
    previous = current;
  }
  return previous[b.length];
}

// "robinsons" and "robinson" are the same word to a commuter
const PLURAL_MIN_CHARS = 4;
const singular = (word: string) => (word.length >= PLURAL_MIN_CHARS && word.endsWith('s') ? word.slice(0, word.length - 1) : word);

// The fewest edits that turn a typed word into a word of the name, or into its start ("robnso" for
// "robinsons"); null when it is too far. A short typed word must start a word of the name exactly.
function wordEdits(typed: string, words: readonly string[]): number | null {
  const allowed = typed.length < ASSISTANT_FUZZY_MIN_CHARS ? 0 : typed.length <= ASSISTANT_FUZZY_SHORT_CHARS ? 1 : ASSISTANT_FUZZY_MAX_EDITS;
  let best: number | null = null;
  for (const word of words) {
    if (word.startsWith(typed)) return 0;
    if (allowed === 0) continue;
    const edits = Math.min(editDistance(singular(typed), singular(word)), editDistance(typed, word.slice(0, typed.length)));
    if (edits <= allowed && (best === null || edits < best)) best = edits;
  }
  return best;
}

export type FuzzyPlace = { place: SearchablePlace; edits: number };

// CA1.1: places whose name holds every typed word, each within a few typing mistakes ("ampayun",
// "robnson"), fewest edits first, then kind (KIND_ORDER), then name. For when rankPlaces finds none.
export function fuzzyPlaces(query: string, places: readonly SearchablePlace[], limit: number): FuzzyPlace[] {
  const typed = normalizeSearch(query).split(' ').filter(Boolean);
  if (typed.length === 0) return [];
  const found: FuzzyPlace[] = [];
  for (const place of places) {
    const words = normalizeSearch(place.title).split(' ');
    let edits: number | null = 0;
    for (const part of typed) {
      const partEdits = wordEdits(part, words);
      edits = partEdits === null ? null : edits + partEdits;
      if (edits === null) break;
    }
    // A name every typed word starts is rankPlaces' own; only names that needed a correction here
    if (edits !== null && edits > 0) found.push({ place, edits });
  }
  return found
    .sort(
      (a, b) =>
        a.edits - b.edits ||
        KIND_ORDER.indexOf(a.place.kind) - KIND_ORDER.indexOf(b.place.kind) ||
        a.place.title.localeCompare(b.place.title),
    )
    .slice(0, limit);
}

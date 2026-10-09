// ST2-C2: typed search for From and To in My Rides, over what is already on the phone: the stops, the
// user's saved places and (ST2-C3) the named places of the offline map: buildings, barangays and
// streets. No network. Case, accents and punctuation are ignored, and a word may be typed in part
// ("doc" finds Butuan Doctors' Hospital).

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

// The best matches, at most `limit`, by rank, then kind (KIND_ORDER), then name
export function searchPlaces(query: string, places: readonly SearchablePlace[], limit: number): SearchablePlace[] {
  const needle = normalizeSearch(query);
  if (needle.length === 0) return [];
  return places
    .map((place) => ({ place, rank: rankOf(needle, place) }))
    .filter((item): item is { place: SearchablePlace; rank: number } => item.rank !== null)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        KIND_ORDER.indexOf(a.place.kind) - KIND_ORDER.indexOf(b.place.kind) ||
        a.place.title.localeCompare(b.place.title),
    )
    .slice(0, limit)
    .map((item) => item.place);
}

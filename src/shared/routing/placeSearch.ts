// ST2-C2: typed search for From and To in My Rides, over what is already on the phone: the stops and
// the user's saved places. No network and no extra data. Case, accents and punctuation are ignored,
// and a word may be typed in part ("doc" finds Butuan Doctors' Hospital).

export type SearchablePlace = {
  id: string;
  title: string;
  // A stop's code (BAN, SMB); none for a saved map point
  code?: string;
  lat: number;
  lon: number;
  kind: 'stop' | 'saved';
};

// Lower rank first: the code typed in full, the name's start, a word's start, every typed word
// starting a word of the name, then the letters anywhere in the name
const RANK_CODE = 0;
const RANK_NAME_START = 1;
const RANK_WORD_START = 2;
const RANK_ALL_WORDS = 3;
const RANK_ANYWHERE = 4;

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

// The best matches, at most `limit`. Saved places come before stops of the same rank; then by name.
export function searchPlaces(query: string, places: readonly SearchablePlace[], limit: number): SearchablePlace[] {
  const needle = normalizeSearch(query);
  if (needle.length === 0) return [];
  return places
    .map((place) => ({ place, rank: rankOf(needle, place) }))
    .filter((item): item is { place: SearchablePlace; rank: number } => item.rank !== null)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Number(a.place.kind !== 'saved') - Number(b.place.kind !== 'saved') ||
        a.place.title.localeCompare(b.place.title),
    )
    .slice(0, limit)
    .map((item) => item.place);
}

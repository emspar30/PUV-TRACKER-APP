import { PLACE_SEARCH_MAX_RESULTS } from '../config';
import { normalizeSearch, searchPlaces, type SearchablePlace } from '../routing/placeSearch';
import { GENERATED_STATIONS } from '../../data/seed/routes.generated';

const stop = (code: string, title: string): SearchablePlace => ({ id: `stop-${code}`, code, title, lat: 0, lon: 0, kind: 'stop' });
const PLACES: SearchablePlace[] = [
  stop('BAN', 'Bancasi Airport'),
  stop('BDH', "Butuan Doctors' Hospital"),
  stop('SMB', 'SM City Butuan'),
  stop('SNO', 'Santo Niño'),
  stop('CSU', 'Caraga State University (Main Campus)'),
  stop('LBT', 'Langihan Bus - Jeep Terminal'),
  stop('LPM', 'Langihan Public Market'),
  { id: 'saved-1', title: 'Langihan home', lat: 0, lon: 0, kind: 'saved' },
];
const titles = (query: string) => searchPlaces(query, PLACES, PLACE_SEARCH_MAX_RESULTS).map((place) => place.title);

describe('place search (ST2-C2)', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalizeSearch("  Santo Niño, Doctors' ")).toBe('santo nino doctors');
    expect(titles('nino')).toEqual(['Santo Niño']);
    expect(titles('DOCTORS')).toEqual(["Butuan Doctors' Hospital"]);
  });

  it('finds a word typed in part, and a stop by its code first', () => {
    expect(titles('doc')).toEqual(["Butuan Doctors' Hospital"]);
    expect(titles('sm')[0]).toBe('SM City Butuan');
    expect(titles('ban')[0]).toBe('Bancasi Airport');
  });

  it('matches several typed words in any order', () => {
    expect(titles('market langihan')).toEqual(['Langihan Public Market']);
    expect(titles('state univ')).toEqual(['Caraga State University (Main Campus)']);
  });

  it('puts a saved place before stops of the same rank, and stops at the limit', () => {
    expect(titles('langihan')).toEqual(['Langihan home', 'Langihan Bus - Jeep Terminal', 'Langihan Public Market']);
    expect(searchPlaces('a', PLACES, 2)).toHaveLength(2);
  });

  it('returns nothing for an empty or unmatched query', () => {
    expect(titles('   ')).toEqual([]);
    expect(titles('zzz')).toEqual([]);
  });

  it('finds every shipped stop by its full name and by its code', () => {
    const places = GENERATED_STATIONS.map((station) => stop(station.code, station.name));
    for (const station of GENERATED_STATIONS) {
      expect(searchPlaces(station.name, places, PLACE_SEARCH_MAX_RESULTS).map((place) => place.code)).toContain(station.code);
      expect(searchPlaces(station.code, places, PLACE_SEARCH_MAX_RESULTS)[0].code).toBe(station.code);
    }
  });
});

import { useMemo } from 'react';

import { useRouteData } from '@/data/RouteDataProvider';
import { MAP_PLACES } from '@/data/seed/places';
import { PLACE_SEARCH_MAX_RESULTS } from '@/shared/config';
import { searchPlaces, type SearchablePlace } from '@/shared/routing/placeSearch';
import { useDestinationsStore } from '@/state/destinationsStore';

// ST2-C2/C3, ST2-D2: what the typed search looks through, on the phone only: the stops, the
// buildings, barangays and streets of the offline map and, where asked for, the user's saved places.
// The relay's destination search leaves the saved places out, so they stay away from what is sent.
export function useSearchablePlaces({ saved }: { saved: boolean }): SearchablePlace[] {
  const { stops } = useRouteData();
  const destinations = useDestinationsStore((state) => state.destinations);
  const places = saved ? destinations : null;
  return useMemo<SearchablePlace[]>(
    () => [
      // A saved place keeps the id it was saved under, which for a stop is the stop's own (stop-LIB): it
      // is listed once, as the saved place, and every kind has its own key prefix
      ...(places ?? []).map((place) => {
        const stop = stops.find((candidate) => `stop-${candidate.code}` === place.id);
        return { id: `saved-${place.id}`, title: stop?.name ?? place.label, code: stop?.code, lat: place.lat, lon: place.lon, kind: 'saved' as const };
      }),
      ...stops
        .filter((stop) => !(places ?? []).some((place) => place.id === `stop-${stop.code}`))
        .map((stop) => ({ id: `stop-${stop.code}`, title: stop.name, code: stop.code, lat: stop.lat, lon: stop.lon, kind: 'stop' as const })),
      ...MAP_PLACES.map(([title, category, group, lat, lon, near], index) => ({
        id: `map-${index}`,
        title,
        lat,
        lon,
        kind: group,
        category,
        near: near || undefined,
      })),
    ],
    [places, stops],
  );
}

// The matches for what is typed; with nothing typed, the saved places (when they are searched)
export function usePlaceMatches(query: string, active: boolean, searchable: readonly SearchablePlace[]): SearchablePlace[] {
  return useMemo(
    () =>
      !active
        ? []
        : query.trim().length > 0
          ? searchPlaces(query, searchable, PLACE_SEARCH_MAX_RESULTS)
          : searchable.filter((place) => place.kind === 'saved').slice(0, PLACE_SEARCH_MAX_RESULTS),
    [active, query, searchable],
  );
}

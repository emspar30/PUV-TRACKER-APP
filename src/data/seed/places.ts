// ST2-C3: the named places of the offline map (scripts/extract-places.py), for the typed search in
// My Rides. A compact tuple per place keeps the bundled module small. Pure data: no React Native or
// Expo imports.

import { GENERATED_PLACES } from './places.generated';

// Name, the map's kind (school, bank, neighbourhood, street ...), its group, latitude, longitude, and
// the nearest barangay or neighbourhood ('' for none, and for a barangay itself)
export type MapPlaceGroup = 'poi' | 'area' | 'street';
export type MapPlace = readonly [name: string, kind: string, group: MapPlaceGroup, lat: number, lon: number, near: string];

export const MAP_PLACES: readonly MapPlace[] = GENERATED_PLACES;

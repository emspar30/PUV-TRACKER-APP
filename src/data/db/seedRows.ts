// Turns the placeholder seed file into table rows. Pure: no React Native or Expo imports.
// Each stop's order and distance along a line are computed from the polyline, not typed in.

import { CHECKIN_RADIUS_M, STATION_LINK_MAX_OFFSET_M } from '../../shared/config';
import { projectOntoLine } from '../../shared/geo/line';
import type { SeedRouteLine, SeedStation } from '../seed/r4.placeholder';

export type RouteRow = {
  route_id: string;
  route_code: string;
  direction: string;
  route_name: string;
  route_color: string;
  direction_mode: string;
  base_fare: number;
  base_km: number;
  per_km_rate: number;
  primary_geojson: string;
  data_version: number;
};

export type StationRow = {
  station_id: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  geofence_m: number;
};

export type RouteStationRow = {
  route_id: string;
  station_id: string;
  seq: number;
  chainage_km: number;
};

export type SeedRows = {
  routes: RouteRow[];
  stations: StationRow[];
  routeStations: RouteStationRow[];
};

export function buildSeedRows(lines: SeedRouteLine[], stations: SeedStation[], version: number): SeedRows {
  const routes = lines.map(
    (line): RouteRow => ({
      route_id: line.routeId,
      route_code: line.routeCode,
      direction: line.direction,
      route_name: line.routeName,
      route_color: line.routeColor,
      direction_mode: line.directionMode,
      base_fare: line.baseFare,
      base_km: line.baseKm,
      per_km_rate: line.perKmRate,
      primary_geojson: JSON.stringify({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: line.coordinates },
      }),
      data_version: version,
    }),
  );

  const stationRows = stations.map(
    (station): StationRow => ({
      // The short code is stable and unique, so it doubles as the id
      station_id: station.code,
      code: station.code,
      name: station.name,
      lat: station.lat,
      lon: station.lon,
      geofence_m: CHECKIN_RADIUS_M,
    }),
  );

  // A stop is linked to each line that passes near it, ordered by distance along that line.
  // R4's return path takes other streets, so it does not serve every outbound stop.
  const routeStations = lines.flatMap((line) =>
    stations
      .map((station) => ({ station, projection: projectOntoLine(line.coordinates, station) }))
      .filter(({ projection }) => projection.offsetM <= STATION_LINK_MAX_OFFSET_M)
      .sort((a, b) => a.projection.chainageKm - b.projection.chainageKm)
      .map(
        ({ station, projection }, index): RouteStationRow => ({
          route_id: line.routeId,
          station_id: station.code,
          seq: index + 1,
          chainage_km: projection.chainageKm,
        }),
      ),
  );

  return { routes, stations: stationRows, routeStations };
}

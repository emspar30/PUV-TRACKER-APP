// Turns route data into database rows. Pure: no database, React Native or Expo imports.

import type { Feature, LineString } from 'geojson';

import { CHECKIN_RADIUS_M, ROUTE_STOP_MAX_DISTANCE_M } from '../../shared/config';
import { projectOntoLine } from '../../shared/geo/line';
import type { RouteData } from '../../shared/routing/types';

import type { FranchiseRouteRow, RouteStationRow, StationRow } from './schema';

export type RouteRows = {
  routes: FranchiseRouteRow[];
  stations: StationRow[];
  routeStations: RouteStationRow[];
};

export function buildRouteRows(data: RouteData): RouteRows {
  const routes: FranchiseRouteRow[] = data.lines.map((line) => {
    const feature: Feature<LineString> = {
      type: 'Feature',
      properties: { route_id: line.id, route_code: line.routeCode, direction: line.direction },
      geometry: { type: 'LineString', coordinates: line.coordinates },
    };
    return {
      route_id: line.id,
      route_code: line.routeCode,
      direction: line.direction,
      route_name: line.name,
      route_color: line.color,
      direction_mode: line.directionMode,
      base_fare: line.fare.baseFare,
      base_km: line.fare.baseKm,
      per_km_rate: line.fare.perKmRate,
      primary_geojson: JSON.stringify(feature),
      data_version: data.version,
    };
  });

  const stations: StationRow[] = data.stops.map((stop) => ({
    station_id: stop.code,
    code: stop.code,
    name: stop.name,
    lat: stop.lat,
    lon: stop.lon,
    geofence_m: CHECKIN_RADIUS_M,
  }));

  // A stop belongs to a line if it lies close enough to it; its order and distance along
  // the line are computed from the geometry, never typed in by hand
  const routeStations: RouteStationRow[] = data.lines.flatMap((line) =>
    data.stops
      .map((stop) => ({ stop, projection: projectOntoLine(line.coordinates, stop) }))
      .filter(({ projection }) => projection.offsetM <= ROUTE_STOP_MAX_DISTANCE_M)
      .sort((a, b) => a.projection.chainageKm - b.projection.chainageKm)
      .map(({ stop, projection }, index) => ({
        route_id: line.id,
        station_id: stop.code,
        seq: index + 1,
        chainage_km: projection.chainageKm,
      })),
  );

  return { routes, stations, routeStations };
}

// Map features for vehicle markers (AF3): one point per vehicle and a heading cone in front of it.
// The cone is sized in screen pixels for the current zoom, so it looks the same at every zoom.
// Vehicles with No data are not drawn. CF1: an Estimated vehicle (silent 90 s to 5 minutes) is drawn
// at its dead-reckoned position along its line and flagged ghost. Pure: no React Native or Expo imports.

import type { Feature, FeatureCollection, Point, Polygon, Position } from 'geojson';

import type { LineCoordinates } from '../geo/line';
import { ageSeconds, coverageOf } from './coverage';
import { displayPosition } from './deadReckoning';
import { seatTier, type SeatTier } from './occupancy';
import { isStopped } from './stopped';
import type { VehicleSnapshot } from './vehicle';

// label: the plate shown beside the marker ("DEMO 01" for demo vehicles)
// heading: degrees clockwise from north, which the vehicle icon is rotated to
// ghost: CF1, drawn at an estimated position (faded, labelled Estimated, no ETA)
export type MarkerProps = {
  id: string;
  label: string;
  tier: SeatTier;
  stale: boolean;
  ghost: boolean;
  stopped: boolean;
  demo: boolean;
  heading: number;
};

const EARTH_CIRCUMFERENCE_M = 40075016.686;
const TILE_SIZE_PX = 512;
const ZOOM_BASE = 2;
const HALF_TURN_DEG = 180;
const DEG_TO_RAD = Math.PI / HALF_TURN_DEG;
const M_PER_DEG_LAT = 111195;

// Ground metres covered by one screen pixel at a latitude and zoom (Web Mercator, 512 px tiles in MapLibre)
export function metersPerPixel(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos(lat * DEG_TO_RAD)) / (TILE_SIZE_PX * ZOOM_BASE ** zoom);
}

// A triangle pointing along the heading: tip `lengthM` ahead, base corners `halfAngleDeg` either side
export function headingCone(lat: number, lon: number, headingDeg: number, lengthM: number, halfAngleDeg: number): Position[] {
  const offset = (bearingDeg: number, distanceM: number): Position => {
    const b = bearingDeg * DEG_TO_RAD;
    const north = (Math.cos(b) * distanceM) / M_PER_DEG_LAT;
    const east = (Math.sin(b) * distanceM) / (M_PER_DEG_LAT * Math.cos(lat * DEG_TO_RAD));
    return [lon + east, lat + north];
  };
  const centre: Position = [lon, lat];
  return [centre, offset(headingDeg - halfAngleDeg, lengthM), offset(headingDeg + halfAngleDeg, lengthM), centre];
}

export type MarkerFeatures = { points: FeatureCollection<Point, MarkerProps>; cones: FeatureCollection<Polygon, MarkerProps> };

export function vehicleMarkerFeatures(
  vehicles: readonly VehicleSnapshot[],
  nowMs: number,
  cone: { lengthPx: number; halfAngleDeg: number; zoom: number },
  // The coordinates of a vehicle's line by its id, for Estimated positions; without it they stay at the last fix
  lineOf: (lineId: string) => LineCoordinates | undefined = () => undefined,
): MarkerFeatures {
  const points: Feature<Point, MarkerProps>[] = [];
  const cones: Feature<Polygon, MarkerProps>[] = [];
  for (const vehicle of vehicles) {
    const coverage = coverageOf(ageSeconds(vehicle.lastPacketMs, nowMs));
    if (coverage === 'none' || vehicle.hidden) continue;
    const at = displayPosition(vehicle, lineOf(vehicle.lineId), nowMs);
    const properties: MarkerProps = {
      id: vehicle.id,
      label: vehicle.label,
      tier: seatTier(vehicle.seatsTaken),
      stale: coverage === 'stale',
      ghost: at.ghost,
      stopped: vehicle.layover === true || isStopped(vehicle.recentSpeeds, vehicle.lastPacketMs),
      demo: vehicle.demo,
      heading: at.headingDeg,
    };
    points.push({ type: 'Feature', id: vehicle.id, properties, geometry: { type: 'Point', coordinates: [at.lon, at.lat] } });
    const lengthM = cone.lengthPx * metersPerPixel(at.lat, cone.zoom);
    cones.push({
      type: 'Feature',
      id: vehicle.id,
      properties,
      geometry: { type: 'Polygon', coordinates: [headingCone(at.lat, at.lon, at.headingDeg, lengthM, cone.halfAngleDeg)] },
    });
  }
  return { points: { type: 'FeatureCollection', features: points }, cones: { type: 'FeatureCollection', features: cones } };
}

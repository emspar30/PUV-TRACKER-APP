// Landmarks the commuter can pick as frequent destinations (PRD 19, D4).
// TODO(placeholder): until Emjay supplies real landmark names and coordinates, the landmarks are
// the placeholder Route 4 stops, taken from the route seed file so no coordinate is repeated.
// Pure data: no React Native or Expo imports.

import { R4_STATIONS } from './r4.placeholder';

export type Landmark = {
  id: string;
  // Short label for a chip
  label: string;
  // Full name, read out by TalkBack
  name: string;
  lat: number;
  lon: number;
};

export const LANDMARKS_ARE_PLACEHOLDER = true;

export const LANDMARKS: readonly Landmark[] = R4_STATIONS.map((station) => ({
  id: `stop-${station.code}`,
  label: station.code,
  name: station.name,
  lat: station.lat,
  lon: station.lon,
}));

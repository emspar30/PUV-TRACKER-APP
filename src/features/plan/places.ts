import { stationsOnLine, type RouteNetwork } from '@/data/db/routeRepository';
import type { LatLon } from '@/shared/geo/haversine';

// Where a trip starts or ends: the phone's own position, a stop, or any point picked on the map
export type Place = { kind: 'here' } | { kind: 'stop'; stationId: string } | { kind: 'point'; at: LatLon };

export type StopOption = {
  stationId: string;
  title: string;
  subtitle: string;
  directions: ('outbound' | 'return')[];
};

const COORD_DECIMALS = 5;

export function placeKey(place: Place | null): string {
  if (!place) return 'none';
  if (place.kind === 'here') return 'here';
  if (place.kind === 'stop') return `stop:${place.stationId}`;
  return `point:${place.at.lat.toFixed(COORD_DECIMALS)},${place.at.lon.toFixed(COORD_DECIMALS)}`;
}

export function formatCoordinates({ lat, lon }: LatLon): string {
  return `${lat.toFixed(COORD_DECIMALS)}, ${lon.toFixed(COORD_DECIMALS)}`;
}

// "Tandang Sora Pob. (Bgy. 12), Butuan City" becomes a title and a quieter subtitle
export function splitStationName(name: string): { title: string; subtitle: string } {
  const comma = name.indexOf(', ');
  return comma < 0 ? { title: name, subtitle: '' } : { title: name.slice(0, comma), subtitle: name.slice(comma + 2) };
}

// Stops in travel order on the first line, then any others, with the directions that serve each
export function stopOptions(network: RouteNetwork): StopOption[] {
  const ordered = network.lines.length > 0 ? stationsOnLine(network, network.lines[0].routeId) : [];
  const rest = network.stations.filter((station) => !ordered.includes(station));
  const directionOf = new Map(network.lines.map((line) => [line.routeId, line.direction]));

  return [...ordered, ...rest].map((station) => {
    const directions = [
      ...new Set(
        network.routeStations
          .filter((link) => link.stationId === station.stationId)
          .flatMap((link) => directionOf.get(link.routeId) ?? []),
      ),
    ].sort();
    return { stationId: station.stationId, ...splitStationName(station.name), directions };
  });
}

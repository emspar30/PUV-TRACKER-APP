import type { RouteNetwork } from '@/data/db/routeRepository';

import { formatCoordinates, placeKey, splitStationName, stopOptions } from '../places';

const line = (routeId: string, direction: 'outbound' | 'return') => ({
  routeId,
  routeCode: 'R4',
  routeName: `Route 4, ${direction}`,
  routeColor: '#00F5D4',
  direction,
  directionMode: 'one_way' as const,
  dataVersion: 2,
  coordinates: [],
  fare: { baseFare: 15, baseKm: 4, perKmRate: 2 },
});

const station = (code: string, name: string) => ({ stationId: code, code, name, lat: 8.9, lon: 125.5, geofenceM: 60 });

const NETWORK: RouteNetwork = {
  version: 2,
  lines: [line('R4-OUT', 'outbound'), line('R4-RET', 'return')],
  stations: [station('RCA', '553 R. Calo, Butuan City (Dunkin Donut)'), station('TSO', 'Tandang Sora Pob. (Bgy. 12), Butuan City'), station('XYZ', 'Unlinked stop')],
  routeStations: [
    { routeId: 'R4-OUT', stationId: 'TSO', seq: 1, chainageKm: 1 },
    { routeId: 'R4-OUT', stationId: 'RCA', seq: 2, chainageKm: 2 },
    { routeId: 'R4-RET', stationId: 'RCA', seq: 1, chainageKm: 5 },
  ],
};

describe('place helpers', () => {
  it('splits a stop name into a title and the rest', () => {
    expect(splitStationName('Tandang Sora Pob. (Bgy. 12), Butuan City')).toEqual({
      title: 'Tandang Sora Pob. (Bgy. 12)',
      subtitle: 'Butuan City',
    });
    expect(splitStationName('De Oro')).toEqual({ title: 'De Oro', subtitle: '' });
  });

  it('lists stops in outbound order, then the rest, with the directions serving each', () => {
    expect(stopOptions(NETWORK).map((s) => [s.stationId, s.directions])).toEqual([
      ['TSO', ['outbound']],
      ['RCA', ['outbound', 'return']],
      ['XYZ', []],
    ]);
  });

  it('gives each kind of place a distinct key', () => {
    const keys = [
      placeKey(null),
      placeKey({ kind: 'here' }),
      placeKey({ kind: 'stop', stationId: 'RCA' }),
      placeKey({ kind: 'point', at: { lat: 8.947459, lon: 125.541426 } }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[3]).toBe('point:8.94746,125.54143');
  });

  it('formats coordinates to five decimals, latitude first', () => {
    expect(formatCoordinates({ lat: 8.9475, lon: 125.5414 })).toBe('8.94750, 125.54140');
  });
});

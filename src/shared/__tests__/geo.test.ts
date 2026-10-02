import { R4_LINES, R4_STATIONS } from '../../data/seed/r4.placeholder';
import { haversineMeters } from '../geo/haversine';
import { isAhead, lineLengthKm, pointAtChainage, projectOntoLine, sliceLengthKm } from '../geo/line';

const station = (code: string) => {
  const found = R4_STATIONS.find((s) => s.code === code);
  if (!found) throw new Error(`missing station ${code}`);
  return found;
};

const OUTBOUND = R4_LINES.find((line) => line.direction === 'outbound')!.coordinates;
const RETURN = R4_LINES.find((line) => line.direction === 'return')!.coordinates;

describe('haversine', () => {
  it('RCA to JCA is about 61 m (within 2 m)', () => {
    const meters = haversineMeters(station('RCA'), station('JCA'));
    expect(meters).toBeGreaterThanOrEqual(59);
    expect(meters).toBeLessThanOrEqual(63);
  });

  it('is zero for the same point and symmetric', () => {
    expect(haversineMeters(station('RCA'), station('RCA'))).toBe(0);
    expect(haversineMeters(station('RCA'), station('DEO'))).toBeCloseTo(
      haversineMeters(station('DEO'), station('RCA')),
      6,
    );
  });

  it('a check-in at JCA for the RCA station is outside a 60 m radius', () => {
    expect(haversineMeters(station('JCA'), station('RCA'))).toBeGreaterThan(60);
  });
});

describe('progress along the line', () => {
  it('chainage increases along the outbound line in stop order', () => {
    const order = ['IMA', 'TSO', 'RCA', 'JCA', 'MCA', 'DEO'];
    const chainages = order.map((code) => projectOntoLine(OUTBOUND, station(code)).chainageKm);
    for (let i = 1; i < chainages.length; i += 1) {
      expect(chainages[i]).toBeGreaterThan(chainages[i - 1]);
    }
    expect(chainages[0]).toBeCloseTo(0, 6);
    expect(chainages[chainages.length - 1]).toBeCloseTo(lineLengthKm(OUTBOUND), 6);
  });

  it('stops sit on the placeholder line', () => {
    for (const s of R4_STATIONS) {
      expect(projectOntoLine(OUTBOUND, s).offsetM).toBeLessThan(1);
    }
  });

  it('reports the offset of a point beside the line', () => {
    const rca = station('RCA');
    // About 111 m north of RCA
    const beside = { lat: rca.lat + 0.001, lon: rca.lon };
    const projection = projectOntoLine(OUTBOUND, beside);
    expect(projection.offsetM).toBeGreaterThan(90);
    expect(projection.offsetM).toBeLessThan(130);
  });

  it('slice length is the difference between two chainages', () => {
    const from = projectOntoLine(OUTBOUND, station('TSO')).chainageKm;
    const to = projectOntoLine(OUTBOUND, station('MCA')).chainageKm;
    expect(sliceLengthKm(from, to)).toBeCloseTo(to - from, 9);
    expect(sliceLengthKm(to, from)).toBe(0);
  });

  it('point at a chainage round-trips through projection', () => {
    const chainage = projectOntoLine(OUTBOUND, station('JCA')).chainageKm;
    const back = pointAtChainage(OUTBOUND, chainage);
    expect(haversineMeters(back, station('JCA'))).toBeLessThan(1);
  });

  it('a destination behind the origin is not ahead on outbound, but is ahead on return', () => {
    const outOrigin = projectOntoLine(OUTBOUND, station('JCA')).chainageKm;
    const outDest = projectOntoLine(OUTBOUND, station('TSO')).chainageKm;
    expect(isAhead(outOrigin, outDest)).toBe(false);

    const retOrigin = projectOntoLine(RETURN, station('JCA')).chainageKm;
    const retDest = projectOntoLine(RETURN, station('TSO')).chainageKm;
    expect(isAhead(retOrigin, retDest)).toBe(true);
  });
});

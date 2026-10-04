import { UNSELECTED_ROUTE_OPACITY } from '../config';
import { routeCodesOf, routeVisibility, stopsForRoute, toggleRoute } from '../ui/routeVisibility';

import { FIXTURE_OUTBOUND, FIXTURE_RETURN, FIXTURE_STOPS, pointAt } from './fixtures/routeFixture';

// Fixed fixtures, not the seed: route T1 (two directions) and a second route T2 one km north
const T2 = {
  ...FIXTURE_OUTBOUND,
  id: 'T2-OUT',
  routeCode: 'T2',
  coordinates: [
    [pointAt(0, 1000).lon, pointAt(0, 1000).lat],
    [pointAt(8, 1000).lon, pointAt(8, 1000).lat],
  ],
};
const LINES = [FIXTURE_OUTBOUND, FIXTURE_RETURN, T2];
const T2_STOP = { code: 'NTH', name: 'North street', ...pointAt(3, 1000) };
const STOPS = [...FIXTURE_STOPS, T2_STOP];

describe('routeVisibility: nothing selected draws nothing', () => {
  it.each(['live', 'checkin', 'ride'] as const)('%s with no selection has no lines, no stops, no route controls', (tab) => {
    const view = routeVisibility(LINES, { tab, selectedRoute: null });
    expect(view.lines).toEqual([]);
    expect(view.stopsRoute).toBeNull();
    expect(view.showRouteControls).toBe(false);
    expect(view.showTrip).toBe(false);
  });

  it('an unknown route counts as no selection', () => {
    expect(routeVisibility(LINES, { tab: 'live', selectedRoute: 'R99' }).lines).toEqual([]);
  });
});

describe('routeVisibility: a selected route', () => {
  it('shows both directions of the selected route at full opacity and its stops', () => {
    const view = routeVisibility(LINES, { tab: 'live', selectedRoute: 'T1' });
    expect(view.lines.filter((line) => line.opacity === 1).map((line) => line.id)).toEqual(['T1-OUT', 'T1-RET']);
    expect(view.stopsRoute).toBe('T1');
  });

  it('draws other routes at 8%', () => {
    expect(UNSELECTED_ROUTE_OPACITY).toBe(0.08);
    const view = routeVisibility(LINES, { tab: 'checkin', selectedRoute: 'T1' });
    expect(view.lines.find((line) => line.id === 'T2-OUT')?.opacity).toBe(0.08);
  });

  it('Live shows the direction switches and "Show whole route" only with a selection; other tabs never', () => {
    expect(routeVisibility(LINES, { tab: 'live', selectedRoute: 'T1' }).showRouteControls).toBe(true);
    expect(routeVisibility(LINES, { tab: 'checkin', selectedRoute: 'T1' }).showRouteControls).toBe(false);
    expect(routeVisibility(LINES, { tab: 'ride', selectedRoute: 'T1' }).showRouteControls).toBe(false);
  });
});

describe('routeVisibility: My Ride', () => {
  it('a trip result draws only the trip layers, no route line', () => {
    const view = routeVisibility(LINES, { tab: 'ride', selectedRoute: null, hasTrip: true });
    expect(view.showTrip).toBe(true);
    expect(view.lines).toEqual([]);
    expect(view.stopsRoute).toBeNull();
  });

  it('a tapped "All routes" card shows that route; clearing it removes the lines', () => {
    expect(routeVisibility(LINES, { tab: 'ride', selectedRoute: 'T2' }).lines.find((line) => line.opacity === 1)?.id).toBe('T2-OUT');
    expect(routeVisibility(LINES, { tab: 'ride', selectedRoute: null, hasTrip: false }).lines).toEqual([]);
  });

  it('only My Ride ever shows the trip layers', () => {
    expect(routeVisibility(LINES, { tab: 'live', selectedRoute: null, hasTrip: true }).showTrip).toBe(false);
  });
});

describe('stops of a route', () => {
  it('lists the stops near the route and leaves out those far from it', () => {
    expect(stopsForRoute(LINES, STOPS, 'T1').map((stop) => stop.code)).toEqual(['AAA', 'BBB', 'CCC']);
    expect(stopsForRoute(LINES, STOPS, 'T2').map((stop) => stop.code)).toEqual(['NTH']);
  });

  it('stops assigned to a route belong only to it, even when another route passes them (RR1)', () => {
    // T2 passes right by AAA, but AAA is assigned to T1 only
    const T2_NEAR = { ...T2, coordinates: [[pointAt(0).lon, pointAt(0).lat], [pointAt(1).lon, pointAt(1).lat]] };
    const assigned = FIXTURE_STOPS.map((stop) => ({ ...stop, routeCodes: ['T1'] }));
    expect(stopsForRoute([FIXTURE_OUTBOUND, T2_NEAR], assigned, 'T2')).toEqual([]);
    expect(stopsForRoute([FIXTURE_OUTBOUND, T2_NEAR], assigned, 'T1').map((stop) => stop.code)).toEqual(['AAA', 'BBB', 'CCC', 'FAR']);
  });

  it('no route gives no stops', () => {
    expect(stopsForRoute(LINES, STOPS, null)).toEqual([]);
    expect(stopsForRoute(LINES, STOPS, 'R99')).toEqual([]);
  });
});

describe('route chips', () => {
  it('lists each route once, in order', () => {
    expect(routeCodesOf(LINES)).toEqual(['T1', 'T2']);
  });

  it('a tapped chip toggles', () => {
    expect(toggleRoute(null, 'T1')).toBe('T1');
    expect(toggleRoute('T1', 'T1')).toBeNull();
    expect(toggleRoute('T1', 'T2')).toBe('T2');
  });
});

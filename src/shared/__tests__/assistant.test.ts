// CA1: the offline assistant. The parser on English and Bisaya questions, then the answers on the
// shipped lines, stops and map places, as the phone has them.

import { getSeedRouteData } from '../../data/routeSource';
import { MAP_PLACES } from '../../data/seed/places';
import { answer, routeStatus, routesToWatch, withChoice, type AssistantContext } from '../assistant/answer';
import { parseQuery, type Intent } from '../assistant/intent';
import { resolvePlace } from '../assistant/resolve';
import { ASSISTANT_CHOICES_MAX, COVERAGE_LIVE_MAX_AGE_S, FARE_REGULAR_MULTIPLIER, GHOST_MAX_AGE_S } from '../config';
import { discountMultiplier } from '../fare/fare';
import { editDistance, fuzzyPlaces, type SearchablePlace } from '../routing/placeSearch';
import type { VehicleSnapshot } from '../telemetry/vehicle';

const data = getSeedRouteData();
const PLACES: SearchablePlace[] = [
  ...data.stops.map((stop) => ({ id: `stop-${stop.code}`, title: stop.name, code: stop.code, lat: stop.lat, lon: stop.lon, kind: 'stop' as const })),
  ...MAP_PLACES.map(([title, category, group, lat, lon, near], index) => ({ id: `map-${index}`, title, lat, lon, kind: group, category, near })),
];
const stop = (code: string) => {
  const found = data.stops.find((candidate) => candidate.code === code);
  if (!found) throw new Error(`no stop ${code}`);
  return found;
};
const NOW = 1_790_000_000_000;
const MS = 1000;

const context = (overrides: Partial<AssistantContext> = {}): AssistantContext => ({
  lines: data.lines,
  stops: data.stops,
  places: PLACES,
  position: { lat: stop('LIB').lat, lon: stop('LIB').lon, title: 'You' },
  fareMultiplier: FARE_REGULAR_MULTIPLIER,
  live: { access: 'open', night: false, vehicles: [], nowMs: NOW },
  ...overrides,
});

const vehicle = (id: string, routeCode: string, ageS: number, at = stop('SMB')): VehicleSnapshot => ({
  id,
  label: id,
  routeCode,
  lineId: data.lines.find((line) => line.routeCode === routeCode)?.id ?? '',
  lat: at.lat,
  lon: at.lon,
  headingDeg: 0,
  speedKmh: 20,
  seatsTaken: 3,
  lastPacketMs: NOW - ageS * MS,
  recentSpeeds: [],
  demo: true,
});

const text = (value: string) => ({ text: value });

describe('the question parser', () => {
  it.each<[string, Intent]>([
    ['Is R4 running?', { kind: 'status', routeCode: 'R4' }],
    ['naa bay R14 karon?', { kind: 'status', routeCode: 'R14' }],
    ['route 4', { kind: 'status', routeCode: 'R4' }],
    ['r 5 status', { kind: 'status', routeCode: 'R5' }],
    ['naa bay multicab?', { kind: 'status', routeCode: null }],
    ['How do I get to SM City?', { kind: 'trip', from: null, to: text('sm city'), focus: 'route' }],
    ['from Libertad to CSU', { kind: 'trip', from: text('libertad'), to: text('csu'), focus: 'route' }],
    ['SM to Libertad', { kind: 'trip', from: text('sm'), to: text('libertad'), focus: 'route' }],
    ['How much is the fare from SM to Ampayon?', { kind: 'trip', from: text('sm'), to: text('ampayon'), focus: 'fare' }],
    ['Pila plete gikan Libertad paingon CSU?', { kind: 'trip', from: text('libertad'), to: text('csu'), focus: 'fare' }],
    ['unsay sakyan paingon sa Robinsons?', { kind: 'trip', from: null, to: text('robinsons'), focus: 'route' }],
    ['paingon Ampayon gikan sa SM', { kind: 'trip', from: text('sm'), to: text('ampayon'), focus: 'route' }],
    ['unsay sakyan sa Langihan', { kind: 'trip', from: null, to: text('langihan'), focus: 'route' }],
    ['pila plete?', { kind: 'trip', from: null, to: null, focus: 'fare' }],
    ['gikan sa SM', { kind: 'trip', from: text('sm'), to: null, focus: 'route' }],
    ['from here to Ampayon', { kind: 'trip', from: null, to: text('ampayon'), focus: 'route' }],
    ['SM City Butuan', { kind: 'trip', from: null, to: text('sm city butuan'), focus: 'route' }],
    // Casual Butuan Bisaya
    ['pilay plete padung CSU', { kind: 'trip', from: null, to: text('csu'), focus: 'fare' }],
    ["pila'y pamasahe gikan Libertad adto Ampayon?", { kind: 'trip', from: text('libertad'), to: text('ampayon'), focus: 'fare' }],
    ['unsay masakyan muadto sa SM?', { kind: 'trip', from: null, to: text('sm'), focus: 'route' }],
    ['kasakyan pa Langihan', { kind: 'trip', from: null, to: text('langihan'), focus: 'route' }],
    ['pa SM', { kind: 'trip', from: null, to: text('sm'), focus: 'route' }],
    ['naay R4 gadagan?', { kind: 'status', routeCode: 'R4' }],
    ['naa pa bay R14?', { kind: 'status', routeCode: 'R14' }],
    ['gabyahe ba ang R5?', { kind: 'status', routeCode: 'R5' }],
    ['naa pa bay multicab?', { kind: 'status', routeCode: null }],
    ['asa ang hunonganan?', { kind: 'nearest', near: null }],
    ['asa ang paradahan duol sa SM?', { kind: 'nearest', near: text('sm') }],
    ['Nearest stop', { kind: 'nearest', near: null }],
    ['asa ang pinakaduol nga sakayan?', { kind: 'nearest', near: null }],
    ['where is the stop', { kind: 'nearest', near: null }],
    ['nearest stop to SM City', { kind: 'nearest', near: text('sm city') }],
    ['hi', { kind: 'help' }],
    ['Maayong buntag!', { kind: 'help' }],
    ['help me', { kind: 'help' }],
    ['   ', { kind: 'help' }],
  ])('%s', (question, intent) => {
    expect(parseQuery(question)).toEqual(intent);
  });

  it('matches whole words only', () => {
    // "to" is inside "Tiniwisan"; "r" alone is not a route
    expect(parseQuery('Tiniwisan Crossing')).toEqual({ kind: 'trip', from: null, to: text('tiniwisan crossing'), focus: 'route' });
    expect(parseQuery('Purok 4')).toEqual({ kind: 'trip', from: null, to: text('purok 4'), focus: 'route' });
  });
});

describe('finding places', () => {
  it('takes a stop code, a full name or a clear match as it is', () => {
    expect(resolvePlace(text('csu'), PLACES)).toMatchObject({ kind: 'found', place: { code: 'CSU' } });
    expect(resolvePlace(text('libertad'), PLACES)).toMatchObject({ kind: 'found', place: { code: 'LIB' } });
    expect(resolvePlace(text('sm city'), PLACES)).toMatchObject({ kind: 'found', place: { code: 'SMB' } });
  });

  it('takes the best of several at once, with the others that fit as well, and says so when none', () => {
    const result = resolvePlace(text('gaisano'), PLACES);
    expect(result).toMatchObject({ kind: 'found', how: 'partial' });
    if (result.kind !== 'found') return;
    expect(result.others.length).toBeGreaterThan(0);
    expect(result.others.length).toBeLessThanOrEqual(ASSISTANT_CHOICES_MAX - 1);
    expect(new Set([result.place.title, ...result.others.map((place) => place.title)]).size).toBe(result.others.length + 1);
    expect(resolvePlace(text('qwxzz'), PLACES)).toEqual({ kind: 'none', text: 'qwxzz' });
  });

  it('CA1.1: a name as typed is exact, with nothing else offered', () => {
    expect(resolvePlace(text('ampayon'), PLACES)).toMatchObject({ kind: 'found', how: 'exact', others: [], place: { code: 'AMP' } });
    expect(resolvePlace(text('csu'), PLACES)).toMatchObject({ how: 'exact', others: [] });
  });

  it('CA1.1: singular, plural and part of a name find Robinsons', () => {
    for (const typed of ['robinsons', 'robinson', 'robinso']) {
      expect(resolvePlace(text(typed), PLACES)).toMatchObject({ kind: 'found', how: 'partial', place: { code: 'ROB' } });
    }
  });

  it('CA1.1: typing mistakes are corrected when no name starts with what was typed', () => {
    expect(resolvePlace(text('ampayun'), PLACES)).toMatchObject({ kind: 'found', how: 'corrected', place: { title: 'Ampayon' } });
    expect(resolvePlace(text('robnson'), PLACES)).toMatchObject({ kind: 'found', how: 'corrected', place: { code: 'ROB' } });
    expect(resolvePlace(text('libertat'), PLACES)).toMatchObject({ kind: 'found', how: 'corrected', place: { code: 'LIB' } });
    // A short word must be typed right; three mistakes are too many
    expect(resolvePlace(text('smx'), PLACES)).toMatchObject({ kind: 'none' });
    expect(resolvePlace(text('ampxxxn'), PLACES)).toMatchObject({ kind: 'none' });
  });

  it('CA1.1: the edit distance counts inserted, removed and changed letters', () => {
    expect(editDistance('ampayun', 'ampayon')).toBe(1);
    expect(editDistance('robnson', 'robinson')).toBe(1);
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
    expect(fuzzyPlaces('ampayon', PLACES, 3).every((item) => item.edits > 0)).toBe(true);
  });
});

describe('trip answers', () => {
  it('gives the route, the walks and the fare from the planner', () => {
    const reply = answer(parseQuery('pila plete gikan Libertad paingon CSU'), context());
    expect(reply).toMatchObject({ kind: 'trip', focus: 'fare', routeCode: 'R3', from: { title: 'Libertad' } });
    if (reply.kind !== 'trip') return;
    expect(reply.fare).toBeGreaterThan(0);
    expect(reply.rideKm).toBeGreaterThan(1);
  });

  it('answers casual Bisaya the same way', () => {
    expect(answer(parseQuery('pilay plete padung CSU'), context())).toMatchObject({ kind: 'trip', focus: 'fare', routeCode: 'R3', from: { mine: true } });
  });

  it('uses the fare type', () => {
    const regular = answer(parseQuery('from Libertad to CSU'), context());
    const student = answer(parseQuery('from Libertad to CSU'), context({ fareMultiplier: discountMultiplier('student') }));
    if (regular.kind !== 'trip' || student.kind !== 'trip') throw new Error('no trip');
    expect(student.fare).toBeLessThan(regular.fare);
  });

  it('starts from the user when no start is named, and asks for a position without one', () => {
    expect(answer(parseQuery('to CSU'), context())).toMatchObject({ kind: 'trip', from: { mine: true } });
    expect(answer(parseQuery('to CSU'), context({ position: null }))).toEqual({ kind: 'needPosition', topic: 'trip' });
  });

  it('asks where to, which place, or says what went wrong', () => {
    expect(answer(parseQuery('pila plete?'), context())).toEqual({ kind: 'needDestination' });
    expect(answer(parseQuery('to qwxzz'), context())).toEqual({ kind: 'notFound', text: 'qwxzz' });
    expect(answer(parseQuery('from Libertad to Libertad'), context())).toMatchObject({ kind: 'tripFail', reason: 'same_place' });
    // CA1.1: a name that fits several is answered for the best at once; a runner-up asks again
    const intent = parseQuery('to gaisano');
    const best = answer(intent, context());
    expect(['trip', 'tripFail']).toContain(best.kind);
    if (best.kind !== 'trip' && best.kind !== 'tripFail') return;
    const [match] = best.matches;
    expect(match).toMatchObject({ slot: 'to', typed: 'gaisano', how: 'partial', title: best.to.title });
    const picked = answer(withChoice(intent, match.slot, match.others[0]), context());
    expect(['trip', 'tripFail']).toContain(picked.kind);
    if (picked.kind === 'trip' || picked.kind === 'tripFail') {
      expect(picked.to.title).toBe(match.others[0].title);
      // Picked from a chip: exact, nothing more to say about the name
      expect(picked.matches).toEqual([]);
    }
  });

  it('CA1.1: "what route should I board for robinsons?" answers the route to Robinsons at once', () => {
    expect(parseQuery('what route should I board for robinsons?')).toEqual({ kind: 'trip', from: null, to: text('robinsons'), focus: 'route' });
    const reply = answer(parseQuery('what route should I board for robinsons?'), context());
    expect(reply).toMatchObject({ kind: 'trip', to: { title: stop('ROB').name }, from: { mine: true } });
    if (reply.kind !== 'trip') return;
    expect(reply.matches).toEqual([expect.objectContaining({ slot: 'to', typed: 'robinsons', how: 'partial', title: stop('ROB').name })]);
  });

  it('CA1.1: other plain-English phrasings and typos give the same trip', () => {
    const toRobinsons = { kind: 'trip', to: { title: stop('ROB').name } };
    for (const question of [
      'robinson',
      'robinso',
      'which multicab should we take towards robinsons',
      'what jeep do i ride for robinsons',
      'how do i get to robinson',
      'robnson',
    ]) {
      expect(answer(parseQuery(question), context())).toMatchObject(toRobinsons);
    }
    const corrected = answer(parseQuery('how much is the fare to ampayun'), context());
    expect(corrected).toMatchObject({ kind: 'trip', focus: 'fare', to: { title: 'Ampayon' } });
    if (corrected.kind === 'trip') expect(corrected.matches[0]).toMatchObject({ how: 'corrected', typed: 'ampayun' });
  });

  it('CA1.1: "for" gives way to a stronger to-marker', () => {
    expect(parseQuery("what's the fare for SM to Ampayon?")).toEqual({ kind: 'trip', from: text('sm'), to: text('ampayon'), focus: 'fare' });
  });
});

describe('status answers', () => {
  it('counts Live, Estimated and Stale multicabs', () => {
    const vehicles = [
      vehicle('a', 'R4', 10),
      vehicle('b', 'R4', COVERAGE_LIVE_MAX_AGE_S + 10),
      vehicle('c', 'R4', GHOST_MAX_AGE_S + 10),
      vehicle('d', 'R3', 5),
      { ...vehicle('e', 'R4', 5), hidden: true },
    ];
    expect(routeStatus(vehicles, 'R4', NOW)).toEqual({ live: 1, estimated: 1, stale: 1, youngestAgeS: 10 });
    expect(answer(parseQuery('Is R4 running?'), context({ live: { access: 'open', night: false, vehicles, nowMs: NOW } }))).toMatchObject({
      kind: 'status',
      routeCode: 'R4',
      live: 1,
      alternative: null,
    });
  });

  it('names an overlapping route with a Live multicab nearby when the route has none', () => {
    const vehicles = [vehicle('r5', 'R5', 5, stop('NIS'))];
    const reply = answer(
      parseQuery('naa bay R4?'),
      context({ position: { ...stop('BAA'), title: 'You' }, live: { access: 'open', night: false, vehicles, nowMs: NOW } }),
    );
    expect(reply).toMatchObject({ kind: 'status', live: 0, alternative: { routeCode: 'R5' } });
  });

  it('keeps to the PRD 0.7 rule, waits for data, and checks the route', () => {
    expect(answer(parseQuery('R4'), context({ live: { access: 'teamOnly', night: false, vehicles: [], nowMs: NOW } }))).toEqual({
      kind: 'statusHidden',
      routeCode: 'R4',
    });
    expect(answer(parseQuery('R4'), context({ live: { access: 'open', night: false, vehicles: [], nowMs: 0 } }))).toEqual({
      kind: 'statusLoading',
      routeCode: 'R4',
    });
    expect(answer(parseQuery('R9'), context())).toMatchObject({ kind: 'unknownRoute', routeCode: 'R9' });
    expect(answer(parseQuery('naa bay multicab?'), context())).toMatchObject({ kind: 'whichRoute', routes: expect.arrayContaining(['R4']) });
  });

  it('watches only the routes asked about and the routes sharing their stops', () => {
    expect(routesToWatch([{ kind: 'help' }], data.stops)).toEqual([]);
    expect(routesToWatch([{ kind: 'status', routeCode: 'R5' }], data.stops)).toEqual(expect.arrayContaining(['R3', 'R4', 'R5']));
  });
});

describe('nearest stop answers', () => {
  it('gives the stop, how far and its routes', () => {
    expect(answer(parseQuery('nearest stop'), context())).toMatchObject({ kind: 'nearest', stop: { code: 'LIB' }, distanceM: 0 });
    expect(answer(parseQuery('nearest stop to SM City'), context({ position: null }))).toMatchObject({
      kind: 'nearest',
      stop: { code: 'SMB' },
      from: { mine: false },
    });
    expect(answer(parseQuery('asa ang pinakaduol nga sakayan'), context({ position: null }))).toEqual({ kind: 'needPosition', topic: 'nearest' });
  });
});

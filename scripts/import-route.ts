// Imports the traced route lines in assets/data/ and the stop list in docs/real_route_stops.md
// into a seed module (RR1, RR2, RR3).
// Run on the PC with the installed tsx:
//   npx tsx scripts/import-route.ts           dry run: report only, writes nothing
//   npx tsx scripts/import-route.ts --write   writes src/data/seed/routes.generated.ts
// The app never reads the GeoJSON files: it reads the generated module, so all parsing,
// simplification and length work happens here, once.
//
// Files are found by name (RR3): route_<n>_outbound, _return, _cycle or _primary .geojson, where an
// _updated file supersedes the plain one. Per-direction files give each leg; a cycle file is split
// at the route's splitAt point; a primary file keeps the RR1 rule (and the RR2 trim), or, when the
// route has a splitAt point (R1, R2: closed loops), is split there like a cycle file.
// Stops (RR3): see src/shared/routing/stopImport.ts for the keep, move and leave-out rule.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Position } from 'geojson';

import { TILESET } from '../src/data/map/tileset';
import { FARE_BASE_KM, FARE_BASE_PHP, FARE_PER_KM_PHP, ROUTE_STOP_MAX_DISTANCE_M, ROUTE_STOP_SNAP_MAX_M } from '../src/shared/config';
import { computeFare } from '../src/shared/fare/fare';
import { planTrip } from '../src/shared/routing/plan';
import {
  findLoops,
  importLegs,
  importRoute,
  isDraftRoute,
  pickRouteFiles,
  stopDistances,
  type ImportedDirection,
  type ImportIssue,
  type ImportOptions,
  type ReturnRule,
} from '../src/shared/routing/routeImport';
import { assignStops, parseStopList } from '../src/shared/routing/stopImport';
import type { DirectedLine } from '../src/shared/routing/types';

type RouteSource = {
  code: string;
  number: number;
  name: string;
  // For a primary file. PUJ route map, October 2026: R3 runs the same road both ways ("vice versa").
  // R4 and R5 return by other roads; their traced files start at the turnaround and run back to
  // the terminal and on into the start of the next trip (docs/route-trace.md).
  rule: ReturnRule;
  // R3 only: a missing leg may be the reverse of the other ("vice versa"). Never for R4 or R5.
  reverseMissing: boolean;
  // RR2: cut a leg at this point when it runs on past it (see trimLine)
  trimAt?: ImportOptions['trimAt'];
  // RR3: where a cycle file is split into outbound and return (the turnaround), when Emjay confirms one
  splitAt?: Position;
};


const SOURCES: RouteSource[] = [
  // R1 and R2 (RR3): closed loops from Bancasi round downtown and back. Split at the point farthest
  // from the start (the importer's proposal, accepted by Emjay 2026-10-08): near Azote St and
  // A.D. Curato St. Names from Emjay (2026-10-08).
  { code: 'R1', number: 1, name: 'Bancasi - Downtown', rule: 'vice_versa', reverseMissing: false, splitAt: [125.54365, 8.94877] },
  { code: 'R2', number: 2, name: 'Bancasi - Langihan', rule: 'vice_versa', reverseMissing: false, splitAt: [125.54437, 8.94871] },
  { code: 'R3', number: 3, name: 'Ampayon-Libertad', rule: 'vice_versa', reverseMissing: true },
  // R4: the updated trace runs De Oro to downtown and on round the downtown loop back to J C Aquino
  // Ave, where it passed before; the outbound is that road back to De Oro (closes_back). No trim:
  // the tail is the start of the outbound.
  { code: 'R4', number: 4, name: 'De Oro', rule: 'closes_back', reverseMissing: false },
  // R5: the same shape as R4, Santo Niño to downtown and on to J C Aquino Ave, where it passed
  // before (closes_back); no trim, the tail is the start of the outbound
  { code: 'R5', number: 5, name: 'Santo Niño', rule: 'closes_back', reverseMissing: false },
  // R14 (RR3): one leg, Robinsons to Taligaman, short of De Oro; the return is not traced and the
  // directions file is empty, so it is the outbound only, a draft (Emjay, 2026-10-08)
  { code: 'R14', number: 14, name: 'Robinsons - De Oro', rule: 'outbound_only', reverseMissing: false },
];

// RR3: a station code for each name in docs/real_route_stops.md (letters only, 2 to 4, for the SMS
// protocol, PRD 12.3). Names at the same position share a code.
const STOP_CODES: Record<string, string> = {
  'Dumalagan Crossing': 'DUM',
  'Bancasi Airport': 'BAN',
  Libertad: 'LIB',
  'Robinsons-Transport Terminal': 'ROB',
  'Robinsons - Transport Terminal': 'ROB',
  'Robinsons-Transport': 'ROB',
  "Butuan Doctors' Hospital": 'BDH',
  'Hotel Oazis': 'OAZ',
  'Hotel Oasis': 'OAZ',
  'SM City Butuan': 'SMB',
  'Zamora Cemetery': 'ZAM',
  SJIT: 'SJI',
  'Butuan Central ES': 'BCE',
  'Agusan National HS': 'ANH',
  'Golden Ribbon Cemetery': 'GRC',
  'M.J. Santos Hospital': 'MJS',
  'Timber City Academy': 'TCA',
  'Timber City Academy Overpass': 'TCA',
  // ST2-C2: stops added to the list on 2026-10-09
  'Embassy Hotel': 'EMB',
  'Palawan Pawnshop': 'PAL',
  'Rosewood Crossing': 'ROS',
  'Lemon Crossing': 'LEM',
  'FSUU (Urios)': 'FSU',
  'Butuan River Park': 'BRP',
  'Post Office': 'POF',
  'Obrero ES': 'OBR',
  'Happy Enterprise': 'HAP',
  'Langihan Public Market': 'LPM',
  'Holy Church Redeemer': 'HCR',
  BCSAT: 'BWB',
  'Water District': 'BWB',
  BIR: 'BWB',
  'BCSAT / Water District / BIR': 'BWB',
  Ampayon: 'AMP',
  'Caraga State University (Main Campus)': 'CSU',
  'CSU Bus Stop': 'CSU',
  'Tiniwisan Crossing': 'TIN',
  Nissan: 'NIS',
  'Baan Viaduct': 'BAA',
  'De Oro': 'DEO',
  Taligaman: 'TAL',
  Antangalon: 'ANT',
  Antongalon: 'ANT',
  'Solar Gas Station': 'SOL',
  LTFRB: 'LTF',
  'Santo Niño': 'SNO',
  'Los Angeles': 'LAN',
  Sumilihon: 'SUM',
  "The Holy Shepherd's Park": 'HSP',
  'Lumina - Taguibo': 'LUM',
  'Langihan Bus - Jeep Terminal': 'LBT',
  'Bridgetown-Rosewood-Windfields': 'BRW',
  'Macapagal Bridge-Pangabugan': 'MAC',
  Mahay: 'MAH',
};

// The name shown for a code whose names differ in the list
const STOP_NAMES: Record<string, string> = {
  ROB: 'Robinsons Transport Terminal',
  OAZ: 'Hotel Oazis',
  BWB: 'BCSAT / Water District / BIR',
  CSU: 'Caraga State University (Main Campus)',
  ANT: 'Antongalon',
  TCA: 'Timber City Academy Overpass',
};

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'assets', 'data');
const OUT = path.join(ROOT, 'src', 'data', 'seed', 'routes.generated.ts');
const STOPS = path.join(ROOT, 'docs', 'real_route_stops.md');
const write = process.argv.includes('--write');
const files = pickRouteFiles(fs.readdirSync(DATA));
const read = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
const fmt = (p: Position) => `${p[0].toFixed(5)}, ${p[1].toFixed(5)}`;

type Result = { source: RouteSource; used: string[]; directionMode: 'one_way' | 'two_way' | 'loop'; directions: ImportedDirection[]; issues: ImportIssue[] };

const results: Result[] = SOURCES.map((source) => {
  const own = files.filter((f) => f.routeNumber === source.number);
  // A closed primary file with a splitAt point is read as a cycle file (R1, R2)
  const legFiles = own
    .filter((f) => f.kind !== 'primary' || source.splitAt)
    .map((f) => (f.kind === 'primary' ? { ...f, kind: 'cycle' as const } : f));
  if (legFiles.length > 0) {
    const legs = importLegs(legFiles.map((file) => ({ file, geojson: read(file.file) })), TILESET.bounds, {
      splitAt: source.splitAt,
      reverseMissing: source.reverseMissing,
    });
    if (legs.turnaround) {
      console.log(`${source.code}: proposed turnaround ${fmt(legs.turnaround.point)} at ${legs.turnaround.chainageKm.toFixed(2)} km (confirm as splitAt)`);
    }
    const directionMode = legs.directions.length === 2 ? 'two_way' : 'one_way';
    return { source, used: legFiles.map((f) => f.file), directionMode, directions: legs.directions, issues: legs.issues };
  }
  const primary = own.find((f) => f.kind === 'primary');
  if (!primary) return { source, used: [], directionMode: 'one_way', directions: [], issues: [{ level: 'fail', message: 'no file for this route' }] };
  const route = importRoute(read(primary.file), source.rule, TILESET.bounds, { trimAt: source.trimAt });
  return { source, used: [primary.file], directionMode: route.directionMode, directions: route.directions, issues: route.issues };
});

// RR3: the stations, from the real stop list checked against these lines
const linesByRoute = Object.fromEntries(results.map(({ source, directions }) => [source.code, directions.map((d) => d.coordinates)]));
const { stations, issues: stopIssues } = assignStops(parseStopList(fs.readFileSync(STOPS, 'utf8')), linesByRoute, STOP_CODES, STOP_NAMES);

for (const { source, used, directions, issues } of results) {
  console.log(`\n${source.code} ${source.name} (${used.join(', ') || 'no file'})${isDraftRoute(directions) ? '  [Draft]' : ''}`);
  for (const d of directions) {
    const first = d.coordinates[0];
    const last = d.coordinates[d.coordinates.length - 1];
    const tags = [d.derived && 'derived', d.partial && 'partial', d.perDirection && 'from its own file'].filter(Boolean).join(', ');
    console.log(`  ${d.direction}: ${d.lengthKm.toFixed(2)} km, ${d.coordinates.length} points, start ${fmt(first)}, end ${fmt(last)}${tags ? ` (${tags})` : ''}`);
    if (d.trim) console.log(`    trim at the terminal: ${d.trim.reason}`);
    for (const loop of findLoops(d.coordinates)) {
      const what = loop.kind === 'overlap' ? 'runs over itself' : 'comes back near itself';
      console.log(
        `    loop: ${what} at ${loop.fromKm.toFixed(2)}-${loop.toKm.toFixed(2)} km, near ${loop.earlierKm.toFixed(2)} km (${Math.round(loop.nearestM)} m), ${loop.lengthKm.toFixed(2)} km round${loop.confirm ? ' - CONFIRM' : ''}`,
      );
    }
    const stops = stopDistances(
      d.coordinates,
      stations.filter((station) => station.routeCodes.includes(source.code)),
    );
    console.log(`    stops: ${stops.map((s) => `${s.code} ${s.passes.map((p) => `${p.chainageKm.toFixed(2)} km/${Math.round(p.offsetM)} m`).join(' & ')}`).join('; ') || 'none within 150 m'}`);
  }
  for (const issue of issues) console.log(`  ${issue.level.toUpperCase()}: ${issue.message}`);
}

console.log(`\nStations: ${stations.length}`);
for (const station of stations.filter((st) => st.moved)) {
  console.log(`  moved onto the line: ${station.code} ${station.name}, ${Math.round(station.moved!.offsetM)} m (${station.routeCodes.join(', ')})`);
}
for (const issue of stopIssues) {
  const what = issue.reason === 'too_far' ? 'left out, too far from the line' : 'dropped from a route after the move';
  console.log(`  ${what}: ${issue.code} ${issue.name}, ${Math.round(issue.offsetM)} m (${issue.routeCodes.join(', ')})`);
}

// What My Ride would answer with these legs (regular fare)
const fare = { baseFare: FARE_BASE_PHP, baseKm: FARE_BASE_KM, perKmRate: FARE_PER_KM_PHP };
const lines: DirectedLine[] = results.flatMap(({ source, directionMode, directions }) =>
  directions.map((d) => ({
    id: `${source.code}-${d.direction === 'outbound' ? 'OUT' : 'RET'}`,
    routeCode: source.code,
    direction: d.direction,
    directionMode,
    name: source.name,
    color: '#000000',
    coordinates: d.coordinates,
    fare,
  })),
);
const stop = (code: string) => stations.find((s) => s.code === code)!;
const trips: [string, { lat: number; lon: number }, { lat: number; lon: number }][] = [
  ['R1 Bancasi to SM City', stop('BAN'), stop('SMB')],
  ['R1 Golden Ribbon to Libertad', stop('GRC'), stop('LIB')],
  ['R2 Libertad to Langihan Market', stop('LIB'), stop('LPM')],
  ['R3 Nissan to Libertad', stop('NIS'), stop('LIB')],
  ['R4 Taligaman to FSUU', stop('TAL'), stop('FSU')],
  ['R5 Los Angeles to Langihan Terminal', stop('LAN'), stop('LBT')],
  ['R14 Robinsons to Taligaman', stop('ROB'), stop('TAL')],
  ['R14 Taligaman to Robinsons (not traced)', stop('TAL'), stop('ROB')],
];
console.log('\nMy Ride with these legs (regular fare):');
for (const [label, from, to] of trips) {
  const plan = planTrip(lines, from, to);
  if (plan.ok) {
    const ride = plan.itinerary.legs[1];
    console.log(`  ${label}: ${ride.routeCode} ${ride.direction}, ${ride.distanceKm.toFixed(2)} km, ₱${computeFare(ride.distanceKm, fare, 1).rounded.toFixed(2)}`);
  } else {
    console.log(`  ${label}: no trip (${plan.reason})`);
  }
}

const failed = results.filter(({ issues }) => issues.some((issue) => issue.level === 'fail'));
if (failed.length > 0) {
  console.log(`\nFAILED: ${failed.map(({ source }) => source.code).join(', ')}. Nothing written.`);
  process.exit(1);
}
if (!write) {
  console.log('\nDry run: nothing written. Add --write to write the seed module.');
  process.exit(0);
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
// A single-quoted TypeScript string, as the rest of the code base writes them
const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const body = results
  .map(({ source, directionMode, directions }) =>
    directions
      .map(
        (d) => `  {
    routeCode: '${source.code}',
    routeName: '${source.name}',
    direction: '${d.direction}',
    directionMode: '${directionMode}',
    derived: ${d.derived},
    partial: ${d.partial},
    perDirection: ${d.perDirection},
    lengthKm: ${d.lengthKm.toFixed(3)},
    coordinates: ${JSON.stringify(d.coordinates.map((p) => [round(p[0]), round(p[1])]))},
  },`,
      )
      .join('\n'),
  )
  .join('\n');

fs.writeFileSync(
  OUT,
  `// GENERATED by scripts/import-route.ts from assets/data/*.geojson and docs/real_route_stops.md.
// Do not edit by hand.
// Traced by Emjay in Google My Maps with the Directions tool and drag points (docs/route-trace.md).
// Pure data: no React Native or Expo imports.

export type GeneratedLine = {
  routeCode: string;
  routeName: string;
  direction: 'outbound' | 'return';
  directionMode: 'one_way' | 'two_way' | 'loop';
  // Made by reversing the traced line (R3 "vice versa")
  derived: boolean;
  // The traced leg stops before the Jeepney Terminal (R4, R5)
  partial: boolean;
  // The leg came from its own file or a cycle split (RR3); the route is a draft until both did
  perDirection: boolean;
  lengthKm: number;
  coordinates: [number, number][];
};

export const GENERATED_LINES: GeneratedLine[] = [
${body}
];

// RR3: docs/real_route_stops.md, checked against the lines above (src/shared/routing/stopImport.ts).
// moved: the listed position was ${ROUTE_STOP_MAX_DISTANCE_M} to ${ROUTE_STOP_SNAP_MAX_M} m from the line and was moved onto it.
// Left out until corrected: ${stopIssues.filter((i) => i.reason === 'too_far').map((i) => `${i.name} (${Math.round(i.offsetM)} m)`).join(', ') || 'none'}.
export type GeneratedStation = {
  code: string;
  name: string;
  lat: number;
  lon: number;
  routeCodes: string[];
  moved: boolean;
};

export const GENERATED_STATIONS: GeneratedStation[] = [
${stations
  .map(
    (st) =>
      `  { code: '${st.code}', name: ${quote(st.name)}, lat: ${round(st.lat)}, lon: ${round(st.lon)}, routeCodes: [${st.routeCodes.map(quote).join(', ')}], moved: ${Boolean(st.moved)} },`,
  )
  .join('\n')}
];
`,
);
console.log(`\nWrote ${path.relative(ROOT, OUT)}`);

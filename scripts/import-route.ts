// Imports the traced route lines in assets/data/ into a seed module (RR1, RR2, RR3).
// Run on the PC with the installed tsx:
//   npx tsx scripts/import-route.ts           dry run: report only, writes nothing
//   npx tsx scripts/import-route.ts --write   writes src/data/seed/routes.generated.ts
// The app never reads the GeoJSON files: it reads the generated module, so all parsing,
// simplification and length work happens here, once.
//
// Files are found by name (RR3): route_<n>_outbound, _return, _cycle or _primary .geojson, where an
// _updated file supersedes the plain one. Per-direction files give each leg; a cycle file is split
// at the route's splitAt point; a primary file keeps the RR1 rule (and the RR2 trim).

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Position } from 'geojson';

import { TILESET } from '../src/data/map/tileset';
import { SEED_STATIONS } from '../src/data/seed/routes';
import { FARE_BASE_KM, FARE_BASE_PHP, FARE_PER_KM_PHP } from '../src/shared/config';
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

// The Jeepney Terminal: Butuan City Integrated Transport Terminal, an assumption Emjay will confirm
// (docs/route-trace.md)
const JEEPNEY_TERMINAL: [number, number] = [125.53601, 8.95933];

const SOURCES: RouteSource[] = [
  { code: 'R3', number: 3, name: 'Ampayon-Libertad', rule: 'vice_versa', reverseMissing: true },
  { code: 'R4', number: 4, name: 'De Oro', rule: 'partial_return', reverseMissing: false, trimAt: { return: JEEPNEY_TERMINAL } },
  { code: 'R5', number: 5, name: 'Santo Niño', rule: 'partial_return', reverseMissing: false, trimAt: { return: JEEPNEY_TERMINAL } },
];

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'assets', 'data');
const OUT = path.join(ROOT, 'src', 'data', 'seed', 'routes.generated.ts');
const write = process.argv.includes('--write');
const files = pickRouteFiles(fs.readdirSync(DATA));
const read = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
const fmt = (p: Position) => `${p[0].toFixed(5)}, ${p[1].toFixed(5)}`;

type Result = { source: RouteSource; used: string[]; directionMode: 'one_way' | 'two_way' | 'loop'; directions: ImportedDirection[]; issues: ImportIssue[] };

const results: Result[] = SOURCES.map((source) => {
  const own = files.filter((f) => f.routeNumber === source.number);
  const legFiles = own.filter((f) => f.kind !== 'primary');
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
    const stops = stopDistances(d.coordinates, SEED_STATIONS);
    console.log(`    stops: ${stops.map((s) => `${s.code} ${s.passes.map((p) => `${p.chainageKm.toFixed(2)} km/${Math.round(p.offsetM)} m`).join(' & ')}`).join('; ') || 'none within 150 m'}`);
  }
  for (const issue of issues) console.log(`  ${issue.level.toUpperCase()}: ${issue.message}`);
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
const stop = (code: string) => SEED_STATIONS.find((s) => s.code === code)!;
const endOf = (code: string, direction: 'outbound' | 'return', end: 'start' | 'end') => {
  const line = lines.find((l) => l.routeCode === code && l.direction === direction) ?? lines.find((l) => l.routeCode === code)!;
  const p = end === 'start' ? line.coordinates[0] : line.coordinates[line.coordinates.length - 1];
  return { lon: p[0], lat: p[1] };
};
const trips: [string, { lat: number; lon: number }, { lat: number; lon: number }][] = [
  ['MCA to DEO', stop('MCA'), stop('DEO')],
  ['DEO to RCA', stop('DEO'), stop('RCA')],
  ['RCA to DEO', stop('RCA'), stop('DEO')],
  ['JCA to MCA', stop('JCA'), stop('MCA')],
  ['R3 Ampayon end to MCA', endOf('R3', 'outbound', 'start'), stop('MCA')],
  ['R3 RCA to Ampayon end', stop('RCA'), endOf('R3', 'outbound', 'start')],
  ['R5 Santo Niño end to MCA', endOf('R5', 'return', 'start'), stop('MCA')],
  ['R5 MCA to Santo Niño end', stop('MCA'), endOf('R5', 'return', 'start')],
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
  `// GENERATED by scripts/import-route.ts from assets/data/*.geojson. Do not edit by hand.
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
`,
);
console.log(`\nWrote ${path.relative(ROOT, OUT)}`);

// Walking along the streets (Emjay, 2026-10-26): the walk to the boarding point and from the
// alighting point follows the roads of the offline map instead of a straight line. The streets are
// stored as lines in Web Mercator tile pixels (scripts/extract-walkways.py). That projection keeps
// shapes, so near Butuan a pixel is the same length in every direction and the search runs on pixels.
// Pure: no React Native or Expo imports.

import { WALK_OFFSTREET_FACTOR, WALK_ROUTE_REACH_M, WALK_ROUTE_WINDOW_M, WALK_SEARCH_MAX_M, WALK_SNAP_CHOICE_M, WALK_SNAP_MAX_M } from '../config';
import type { LatLon } from '../geo/haversine';
import { lineEndKm, projectOntoLine, sliceCoordinates, type LineCoordinates } from '../geo/line';

export type WalkwayBase = { x: number; y: number; zoom: number; extent: number };

export type WalkGraph = {
  base: WalkwayBase;
  // Node positions in global pixels
  xs: Float64Array;
  ys: Float64Array;
  // Neighbours of each node
  links: number[][];
  // Every street segment as a pair of node indexes, and a grid of them for finding the nearest
  segments: Int32Array;
  cells: Map<number, number[]>;
};

export type WalkPath = {
  points: LatLon[];
  lengthM: number;
};

const FULL_TURN_DEG = 360;
const HALF_TURN_DEG = 180;
const DEG_TO_RAD = Math.PI / HALF_TURN_DEG;
const EARTH_CIRCUMFERENCE_M = 40075016.686;
const TWO = 2;
// Grid cells for the segment search, in pixels (about 75 m here)
const CELL_PX = 256;
// Keys: a column (or x) times this plus a row (or y), both far below it
const CELL_KEY = 1_000_000;
const SEGMENT_ENDS = 2;
const NONE = -1;

function worldPx(base: WalkwayBase): number {
  return base.extent * TWO ** base.zoom;
}

function toPixel(base: WalkwayBase, p: LatLon): [number, number] {
  const size = worldPx(base);
  const x = ((p.lon + HALF_TURN_DEG) / FULL_TURN_DEG) * size;
  const y = ((1 - Math.asinh(Math.tan(p.lat * DEG_TO_RAD)) / Math.PI) / TWO) * size;
  return [x, y];
}

function toLatLon(base: WalkwayBase, x: number, y: number): LatLon {
  const size = worldPx(base);
  return {
    lon: (x / size) * FULL_TURN_DEG - HALF_TURN_DEG,
    lat: Math.atan(Math.sinh(Math.PI * (1 - (TWO * y) / size))) / DEG_TO_RAD,
  };
}

// Metres in one pixel at a latitude
function metresPerPixel(base: WalkwayBase, lat: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos(lat * DEG_TO_RAD)) / worldPx(base);
}

const cellKey = (cx: number, cy: number) => cx * CELL_KEY + cy;

// Reads the stored lines ("x,y,dx,dy,..." from the base) into a graph; points shared by lines join them
export function buildWalkGraph(base: WalkwayBase, lines: readonly string[]): WalkGraph {
  const index = new Map<number, number>();
  const xs: number[] = [];
  const ys: number[] = [];
  const links: number[][] = [];
  const segments: number[] = [];
  const nodeAt = (x: number, y: number) => {
    const key = x * CELL_KEY + y;
    let node = index.get(key);
    if (node === undefined) {
      node = xs.length;
      index.set(key, node);
      xs.push(base.x + x);
      ys.push(base.y + y);
      links.push([]);
    }
    return node;
  };
  for (const line of lines) {
    const values = line.split(',').map(Number);
    let x = values[0];
    let y = values[1];
    let previous = nodeAt(x, y);
    for (let i = SEGMENT_ENDS; i + 1 < values.length; i += SEGMENT_ENDS) {
      x += values[i];
      y += values[i + 1];
      const node = nodeAt(x, y);
      if (node !== previous) {
        links[previous].push(node);
        links[node].push(previous);
        segments.push(previous, node);
      }
      previous = node;
    }
  }
  const cells = new Map<number, number[]>();
  for (let s = 0; s < segments.length / SEGMENT_ENDS; s++) {
    const a = segments[s * SEGMENT_ENDS];
    const b = segments[s * SEGMENT_ENDS + 1];
    const [x0, x1] = [Math.min(xs[a], xs[b]), Math.max(xs[a], xs[b])].map((v) => Math.floor(v / CELL_PX));
    const [y0, y1] = [Math.min(ys[a], ys[b]), Math.max(ys[a], ys[b])].map((v) => Math.floor(v / CELL_PX));
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const key = cellKey(cx, cy);
        const list = cells.get(key);
        if (list) list.push(s);
        else cells.set(key, [s]);
      }
    }
  }
  return { base, xs: Float64Array.from(xs), ys: Float64Array.from(ys), links, segments: Int32Array.from(segments), cells };
}

type Snap = { a: number; b: number; x: number; y: number; offsetPx: number };

// Every street within maxPx, each at its point nearest (px, py), nearest first; one per segment
function snaps(graph: WalkGraph, px: number, py: number, maxPx: number): Snap[] {
  const { xs, ys, segments, cells } = graph;
  const found = new Map<number, Snap>();
  const reach = Math.ceil(maxPx / CELL_PX);
  const cx = Math.floor(px / CELL_PX);
  const cy = Math.floor(py / CELL_PX);
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dy = -reach; dy <= reach; dy++) {
      for (const s of cells.get(cellKey(cx + dx, cy + dy)) ?? []) {
        if (found.has(s)) continue;
        const a = segments[s * SEGMENT_ENDS];
        const b = segments[s * SEGMENT_ENDS + 1];
        const ex = xs[b] - xs[a];
        const ey = ys[b] - ys[a];
        const t = Math.max(0, Math.min(1, ((px - xs[a]) * ex + (py - ys[a]) * ey) / (ex * ex + ey * ey)));
        const x = xs[a] + t * ex;
        const y = ys[a] + t * ey;
        const offsetPx = Math.hypot(x - px, y - py);
        if (offsetPx <= maxPx) found.set(s, { a, b, x, y, offsetPx });
      }
    }
  }
  return [...found.values()].sort((p, q) => p.offsetPx - q.offsetPx);
}

// The streets a walk may start or end on: the nearest, and any other within WALK_SNAP_CHOICE_M more.
// A point at a dead end, or in the middle of a block, can then step to a street a few metres away
// instead of going round by the nearest one.
function choices(graph: WalkGraph, px: number, py: number, maxPx: number, choicePx: number): Snap[] {
  const all = snaps(graph, px, py, maxPx);
  return all.length === 0 ? [] : all.filter((candidate) => candidate.offsetPx <= all[0].offsetPx + choicePx);
}

// A binary heap of node indexes by cost
class Queue {
  private items: number[] = [];
  private costs: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, cost: number) {
    this.items.push(item);
    this.costs.push(cost);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.costs[parent] <= this.costs[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop() as number;
    const lastCost = this.costs.pop() as number;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.costs[0] = lastCost;
      let i = 0;
      for (;;) {
        const left = TWO * i + 1;
        const right = left + 1;
        let least = i;
        if (left < this.items.length && this.costs[left] < this.costs[least]) least = left;
        if (right < this.items.length && this.costs[right] < this.costs[least]) least = right;
        if (least === i) break;
        this.swap(i, least);
        i = least;
      }
    }
    return top;
  }
  private swap(i: number, j: number) {
    [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    [this.costs[i], this.costs[j]] = [this.costs[j], this.costs[i]];
  }
}

type Pixel = [number, number];
// Where a search may leave the streets: the cost from that node to the goal, and the pixels drawn
// after the node
type Exit = { cost: number; tail: Pixel[] };
// A walk that uses no street node (both ends beside one segment, or the start beside the route)
type Direct = { cost: number; pixels: Pixel[] };

const between = (x0: number, y0: number, x1: number, y1: number) => Math.hypot(x1 - x0, y1 - y0);

// The cheapest walk from the start choices to any exit, or the direct walk when that is cheaper;
// costs in pixels. The guess must never overestimate (A*; a guess of 0 is plain Dijkstra).
function search(
  graph: WalkGraph,
  starts: readonly Snap[],
  exits: ReadonlyMap<number, Exit>,
  direct: Direct | null,
  guess: (node: number) => number,
  maxCostPx: number,
): Pixel[] | null {
  const { xs, ys, links } = graph;
  let bestCost = direct?.cost ?? Infinity;
  const best = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const enteredFrom = new Map<number, Snap>();
  const queue = new Queue();
  for (const start of starts) {
    for (const node of [start.a, start.b]) {
      const cost = start.offsetPx * WALK_OFFSTREET_FACTOR + between(start.x, start.y, xs[node], ys[node]);
      if (cost < (best.get(node) ?? Infinity)) {
        best.set(node, cost);
        enteredFrom.set(node, start);
        queue.push(node, cost + guess(node));
      }
    }
  }
  let reached = NONE;
  const done = new Set<number>();
  while (queue.size > 0) {
    const node = queue.pop();
    if (done.has(node)) continue;
    done.add(node);
    const cost = best.get(node) as number;
    if (cost + guess(node) >= bestCost || cost > maxCostPx) break;
    const exit = exits.get(node);
    if (exit !== undefined && cost + exit.cost < bestCost) {
      reached = node;
      bestCost = cost + exit.cost;
    }
    for (const next of links[node]) {
      const nextCost = cost + between(xs[node], ys[node], xs[next], ys[next]);
      if (nextCost < (best.get(next) ?? Infinity)) {
        best.set(next, nextCost);
        cameFrom.set(next, node);
        enteredFrom.delete(next);
        queue.push(next, nextCost + guess(next));
      }
    }
  }
  if (reached === NONE) return direct?.pixels ?? null;
  const nodes: number[] = [];
  let node: number | undefined = reached;
  for (; node !== undefined && !enteredFrom.has(node); node = cameFrom.get(node)) nodes.push(node);
  if (node === undefined) return direct?.pixels ?? null;
  nodes.push(node);
  nodes.reverse();
  const start = enteredFrom.get(node) as Snap;
  return [[start.x, start.y], ...nodes.map((n): Pixel => [xs[n], ys[n]]), ...(exits.get(reached) as Exit).tail];
}

function pathOf(base: WalkwayBase, scale: number, pixels: readonly Pixel[]): WalkPath {
  let lengthPx = 0;
  for (let i = 1; i < pixels.length; i++) lengthPx += between(pixels[i - 1][0], pixels[i - 1][1], pixels[i][0], pixels[i][1]);
  return { points: pixels.map(([x, y]) => toLatLon(base, x, y)), lengthM: lengthPx * scale };
}

// The shortest walk along the streets from one point to another: from the start to a street near
// it, along the streets, then off to the end. Steps off the streets count WALK_OFFSTREET_FACTOR times
// their length, so a short step to a nearby street wins over a long way round, but not over the
// streets. Null when either point is more than WALK_SNAP_MAX_M from a street or no streets connect
// them; the caller then draws a straight line.
export function walkPath(graph: WalkGraph, from: LatLon, to: LatLon): WalkPath | null {
  const { base, xs, ys } = graph;
  const scale = metresPerPixel(base, from.lat);
  const maxPx = WALK_SNAP_MAX_M / scale;
  const choicePx = WALK_SNAP_CHOICE_M / scale;
  const [fx, fy] = toPixel(base, from);
  const [tx, ty] = toPixel(base, to);
  const starts = choices(graph, fx, fy, maxPx, choicePx);
  const ends = choices(graph, tx, ty, maxPx, choicePx);
  if (starts.length === 0 || ends.length === 0) return null;
  const off = (snapped: Snap) => snapped.offsetPx * WALK_OFFSTREET_FACTOR;

  // A start and an end on the same segment: straight along it
  let direct: Direct | null = null;
  for (const start of starts) {
    for (const end of ends) {
      const same = (start.a === end.a && start.b === end.b) || (start.a === end.b && start.b === end.a);
      const cost = off(start) + between(start.x, start.y, end.x, end.y) + off(end);
      if (same && cost < (direct?.cost ?? Infinity)) {
        direct = {
          cost,
          pixels: [
            [start.x, start.y],
            [end.x, end.y],
          ],
        };
      }
    }
  }
  const exits = new Map<number, Exit>();
  for (const end of ends) {
    for (const node of [end.a, end.b]) {
      const cost = between(xs[node], ys[node], end.x, end.y) + off(end);
      if (cost < (exits.get(node)?.cost ?? Infinity)) exits.set(node, { cost, tail: [[end.x, end.y]] });
    }
  }
  // Straight to the end point never overestimates: every exit is at least that long
  const pixels = search(graph, starts, exits, direct, (node) => between(xs[node], ys[node], tx, ty), Infinity);
  return pixels ? pathOf(base, scale, [[fx, fy], ...pixels, [tx, ty]]) : null;
}

// The point of a polyline (pixels) nearest (x, y), and how far it is
function nearestOnPolyline(line: readonly Pixel[], x: number, y: number): { point: Pixel; distancePx: number } {
  let point: Pixel = line[0];
  let distancePx = between(x, y, line[0][0], line[0][1]);
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const ex = bx - ax;
    const ey = by - ay;
    const lengthSq = ex * ex + ey * ey;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / lengthSq));
    const px = ax + t * ex;
    const py = ay + t * ey;
    const d = between(x, y, px, py);
    if (d < distancePx) {
      point = [px, py];
      distancePx = d;
    }
  }
  return { point, distancePx };
}

export type WalkToRoute = WalkPath & {
  // Where the walk meets the route, on the route line
  reached: LatLon;
};

// The shortest walk along the streets from a point to anywhere on a stretch of the route (Emjay,
// 2026-10-26): the rider boards (or gets off) where the walk meets the route, instead of walking
// beside the route to a point chosen in a straight line. A street meets the route where it passes
// within WALK_ROUTE_REACH_M of the route line. Null when the point is far from every street, or no
// street within WALK_SEARCH_MAX_M of walking meets the stretch.
export function walkToRoute(graph: WalkGraph, from: LatLon, route: readonly (readonly number[])[]): WalkToRoute | null {
  if (route.length === 0) return null;
  const { base, xs, ys, segments, cells } = graph;
  const scale = metresPerPixel(base, from.lat);
  const reachPx = WALK_ROUTE_REACH_M / scale;
  const [fx, fy] = toPixel(base, from);
  const line = route.map(([lon, lat]) => toPixel(base, { lat, lon }));
  const starts = choices(graph, fx, fy, WALK_SNAP_MAX_M / scale, WALK_SNAP_CHOICE_M / scale);

  // Already beside the route: step straight onto it
  const here = nearestOnPolyline(line, fx, fy);
  const direct: Direct | null = here.distancePx <= reachPx ? { cost: here.distancePx, pixels: [here.point] } : null;
  if (starts.length === 0 && !direct) return null;

  // Every street point within reach of the route is an exit onto the nearest point of the route
  const exits = new Map<number, Exit>();
  const seen = new Set<number>();
  const reachCells = Math.ceil(reachPx / CELL_PX) + 1;
  for (let i = 0; i < line.length; i++) {
    // Each segment of the route, by the cells along it
    const [ax, ay] = line[Math.max(0, i - 1)];
    const [bx, by] = line[i];
    const steps = Math.max(1, Math.ceil(between(ax, ay, bx, by) / CELL_PX));
    for (let k = 0; k <= steps; k++) {
      const cx = Math.floor((ax + ((bx - ax) * k) / steps) / CELL_PX);
      const cy = Math.floor((ay + ((by - ay) * k) / steps) / CELL_PX);
      for (let dx = -reachCells; dx <= reachCells; dx++) {
        for (let dy = -reachCells; dy <= reachCells; dy++) {
          for (const s of cells.get(cellKey(cx + dx, cy + dy)) ?? []) {
            for (const node of [segments[s * SEGMENT_ENDS], segments[s * SEGMENT_ENDS + 1]]) {
              if (seen.has(node)) continue;
              seen.add(node);
              const near = nearestOnPolyline(line, xs[node], ys[node]);
              if (near.distancePx <= reachPx) exits.set(node, { cost: near.distancePx, tail: [near.point] });
            }
          }
        }
      }
    }
  }
  const pixels = search(graph, starts, exits, direct, () => 0, WALK_SEARCH_MAX_M / scale);
  if (!pixels) return null;
  const all: Pixel[] = [[fx, fy], ...pixels];
  const [rx, ry] = all[all.length - 1];
  return { ...pathOf(base, scale, all), reached: toLatLon(base, rx, ry) };
}

export type TripWalks = {
  // Where the ride starts and ends along the line
  boardChainageKm: number;
  alightChainageKm: number;
  boardAt: LatLon;
  alightAt: LatLon;
  // The two walks, each from the picked point to the route
  toBoard: LatLon[];
  fromAlight: LatLon[];
};

const M_PER_KM = 1000;
// A line needs two points
const MIN_LINE_POINTS = 2;

// The walks of a planned trip along the streets (Emjay, 2026-10-26). Each walk goes to wherever it
// first meets the ridden line within WALK_ROUTE_WINDOW_M of the planned boarding (or alighting)
// point, so the ride is drawn from there. When a walk cannot follow the streets, it goes to the
// planned point, along the streets if it can and straight if not.
export function walksForTrip(
  graph: WalkGraph,
  line: LineCoordinates,
  plan: { boardChainageKm: number; alightChainageKm: number; from: LatLon; to: LatLon },
  origin: LatLon,
  destination: LatLon,
): TripWalks {
  const windowKm = WALK_ROUTE_WINDOW_M / M_PER_KM;
  const endKm = lineEndKm(line);
  const onLine = (fromKm: number, toKm: number, walk: WalkToRoute | null) => {
    if (!walk) return null;
    const stretch = sliceCoordinates(line, fromKm, toKm);
    return stretch.length < MIN_LINE_POINTS ? null : { km: fromKm + projectOntoLine(stretch, walk.reached).chainageKm, walk };
  };
  const boardFrom = Math.max(0, plan.boardChainageKm - windowKm);
  const alightTo = Math.min(endKm, plan.alightChainageKm + windowKm);
  const boardStretch = sliceCoordinates(line, boardFrom, plan.alightChainageKm);
  const alightStretch = sliceCoordinates(line, plan.boardChainageKm, alightTo);
  let board = onLine(boardFrom, plan.alightChainageKm, boardStretch.length < MIN_LINE_POINTS ? null : walkToRoute(graph, origin, boardStretch));
  let alight = onLine(plan.boardChainageKm, alightTo, alightStretch.length < MIN_LINE_POINTS ? null : walkToRoute(graph, destination, alightStretch));
  // The two walks must leave some ride between them
  if (board && alight && board.km >= alight.km) {
    board = null;
    alight = null;
  }
  const straight = (from: LatLon, to: LatLon) => walkPath(graph, from, to)?.points ?? [from, to];
  return {
    boardChainageKm: board?.km ?? plan.boardChainageKm,
    alightChainageKm: alight?.km ?? plan.alightChainageKm,
    boardAt: board?.walk.reached ?? plan.from,
    alightAt: alight?.walk.reached ?? plan.to,
    toBoard: board?.walk.points ?? straight(origin, plan.from),
    fromAlight: alight?.walk.points ?? straight(destination, plan.to),
  };
}

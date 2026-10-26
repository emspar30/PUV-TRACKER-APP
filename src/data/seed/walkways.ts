// Walking along the streets (Emjay, 2026-10-26): the street graph of the offline map, built the first
// time a walk is drawn and kept. Pure data: no React Native or Expo imports.

import { buildWalkGraph, type WalkGraph } from '../../shared/routing/walk';

import { WALKWAY_BASE, WALKWAY_LINES } from './walkways.generated';

let graph: WalkGraph | null = null;

export function walkGraph(): WalkGraph {
  graph ??= buildWalkGraph(WALKWAY_BASE, WALKWAY_LINES);
  return graph;
}

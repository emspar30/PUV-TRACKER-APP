// DT1 (PRD 10.5): known detour lines, such as a bridge bypass. Each belongs to one route and is used
// only while an admin has it active (admin_set_detour on the server; the app reads active_detours).
// While active, a relay that follows it passes the verification window's route test (Active Detour
// Mode), and the Map draws it dashed yellow. Fares never use it: they keep the authorized route's
// length. Empty until the partner's traced detour lines come in (D8).
//
// Format: id is unique and stable (it is the server's alternative_id, letters, digits and dashes);
// coordinates are [lon, lat] pairs along the road, in riding order, like the route lines. After adding
// one, rerun `npx tsx scripts/server-route-lines.ts` so the ingest function knows it, and bump
// ROUTE_DATA_VERSION.

import type { Position } from 'geojson';

export type DetourLine = {
  id: string;
  routeCode: string;
  name: string;
  coordinates: Position[];
};

export const SEED_DETOURS: readonly DetourLine[] = [];

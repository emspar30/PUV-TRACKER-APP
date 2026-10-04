# Route traces

## Active lines (RR1, 2026-10-04): Emjay's traces of R3, R4 and R5

| Item | Value |
| --- | --- |
| Source files | `assets/data/route_3_primary.geojson`, `route_4_primary.geojson`, `route_5_primary.geojson`, exported from Google My Maps |
| Method | Google My Maps **Directions** tool with drag points (Emjay, 2026-10-05). The turns My Maps gave are Emjay's record: `assets/data/route_3_return_directions.txt`, `route_4_return_directions.txt`, `route_5_return_directions.txt`. `route_4_primary_updated.geojson` supersedes `route_4_primary.geojson` (kept in git history); the importer uses an `_updated` file where one exists. |
| Credit | The lines are Emjay's own tracing. OpenStreetMap (© OpenStreetMap contributors) is credited only for the basemap. |
| Import | `npx tsx scripts/import-route.ts` (dry run), `--write` writes `src/data/seed/routes.generated.ts`; names, colours, fares and stops are in `src/data/seed/routes.ts` (route data version 3) |
| Simplification | Turf, 5 m: R3 284 → 22 points, R4 412 → 57, R5 465 → 64; largest deviation 4.86 m |

| Route | Stored | Length | Note |
| --- | --- | --- | --- |
| R3 Ampayon-Libertad | outbound (traced, Ampayon → Libertad) and return (**derived**: the reverse) | 11.42 km each | "Vice versa" on the PUJ map |
| R4 De Oro | **return only**, De Oro Barangay Hall → 524 R. Calo; **partial: does not reach the Jeepney Terminal** | 18.64 km | Outbound not provided |
| R5 Santo Niño | **return only**, Santo Niño → 1203 J C Aquino Ave; **partial: does not reach the Jeepney Terminal** | 22.71 km | Outbound not provided. 14 points lie up to 1.46 km north of the current tiles and draw over blank map until the larger tile set (north 9.07) arrives. |

### Inspection of the files (RR2/RR3, 2026-10-05, read-only)

| File | Points | Length | Start → end | Closed? | Farthest from start | Jeepney Terminal | Beyond the terminal | Self-overlaps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `route_3_primary` | 284 | 11.43 km | Ampayon (125.60229, 8.96161) → Libertad (125.50182, 8.94379) | open (11.2 km) | its end | 1.29 km away: not served | — | none |
| `route_4_primary` (old) | 412 | 18.65 km | De Oro (DEO) → R. Calo (125.54144, 8.94754) | open | 125.52796, 8.95356 at 16.53 km (Jose Rosales Ave) | 157 m at 15.50 km | 3.15 km, passes IMA, TSO, RCA again | none |
| `route_4_primary_updated` | 427 | 19.56 km | De Oro (DEO) → M. Calo / J C Aquino (125.54426, 8.94720) | open | same | **157 m** at 15.50 km (Magsaysay St) | 4.06 km: J. Satorre, Jose Rosales Ave, JAQNO, R. Calo, T. Sanchez, M. Calo; passes IMA, TSO, RCA, JCA, MCA again | 37 m at 18.64 km over 13.05 km (the R. Calo / JAQNO corner) |
| `route_5_primary` | 465 | 22.73 km | Santo Niño (125.59722, 9.03307) → M. Calo / J C Aquino (125.54427, 8.94728) | open | 125.53197, 8.94568 at 17.40 km | 23 m at 19.90 km (Andaya St) | 2.82 km: Andaya, Montilla, JAQNO, R. Calo, T. Sanchez, M. Calo; passes RCA, JCA, MCA again | 125 m at 21.71 km over 16.41 km (JAQNO, both ways) |

- **What the files are.** Each R4 and R5 file starts at its turnaround (De Oro, Santo Niño), runs the whole return to the terminal, then **continues into the start of the next outbound** (the downtown loop R. Calo, T. Sanchez, M. Calo). None is a closed cycle, so "the point farthest from the start" is downtown, not a turnaround.
- **Text files against the lines.** Street order matches in all three. Totals match: R3 11.42 km (text) vs 11.43 km; R4 19.56 km vs 19.56 km (`_updated`); R5 22.72 km vs 22.73 km. **No mismatch found.**
- **Stops within 150 m of `route_4_primary_updated`:** DEO 0.00 km (0 m); MCA 12.74 km (12 m) and 19.55 km (1 m); JCA 13.00 km (5 m) and 18.65 km (59 m); RCA 13.05 km (9 m) and 18.66 km (1 m); IMA 17.32 km (7 m); TSO 17.70 km (4 m).
- **RR2 diagnosis, DEO to RCA (stored R4 line):** DEO is passed once (0.00 km, 0 m); RCA twice (13.05 km, 9 m; 18.64 km, 9 m). Rides: 13.05 km ₱35.00 or 18.64 km ₱45.00 (regular). The planner took the nearest point, the second pass. **Cause: both** (the tail in the trace gives the second pass; the nearest-point snapping picked it). RR2 now rides to the first pass ahead of the origin: 13.05 km, ₱35.00.
- **RR2 trim at the terminal (dry run):** R5 trimmed by 2.82 km (terminal 23 m from the line). **R4 not trimmed:** the terminal is 157 m from the line, over the 150 m limit (backlog 82).
- **T. Sanchez loop.** It lies in the tails (the start of the outbound). The traced line never comes back within 20 m there, so it is not an overlap; the loop report lists it, and the R4 tail, as "comes back near itself" for confirmation. It never fails the import.

**Legs Emjay may supply later**

| Leg | Streets (PUJ route map, October 2026) |
| --- | --- |
| R4 outbound | Jeepney Terminal, Rosales Ave, JAQNO, R. Calo St, T. Sanchez St, M. Calo St, Ampayon, De Oro |
| Rest of the R4 return | R. Calo St, R. Rosales St, North Montilla Blvd, Jeepney Terminal |
| R5 outbound | Jeepney Terminal, North Montilla Blvd, JAQNO, R. Calo St, T. Sanchez St, M. Calo St, Ampayon, Santo Niño |
| Rest of the R5 return | J C Aquino Ave, Rosales Ave, Langihan, Jeepney Terminal |

**What the app does meanwhile.** It plans only in the travel direction of a stored line. On R4 and R5 the outbound direction says "Wrong direction for this route" (no trip found). Only the stored direction appears in the Outbound and Return chips.

**Stops.** The six placeholder stops belong to R4 only. Distance to the traced R4 line: IMA 5 m, TSO 2 m, RCA 9 m, JCA 2 m, MCA 12 m. DEO was 1,076 m off and was moved onto the start of the line (De Oro Barangay Hall), marked "location not verified" (Emjay's decision). R3 and R5 have no stops yet.

## Earlier: the partner's candidate trace (not active)

How the Route 4 lines in the partner's commit (now `src/data/seed/r4.traced.candidate.ts`, not active) were made, so they can be checked or redone. Done on 2026-10-03. Emjay's traced R4 lies up to 756 m from it.

**Status:** placeholder. The lines follow real streets in the order the PRD 12.5 route description lists them, but nobody has ridden them. Replace them with a GPS trace of a real ride before the pilot, as PRD 12.5 asks.

## Sources

- **Street names and shapes:** the roads in `assets/map/butuan.pmtiles` (Protomaps build 20261002, from OpenStreetMap). The OpenStreetMap Overpass servers were overloaded on the day, so the tile file was used instead.
- **Joining the waypoints along the roads:** the public OSRM demo router (`router.project-osrm.org`, car profile, `continue_straight=true`), which also uses OpenStreetMap data.
- **Licence:** OpenStreetMap data, © OpenStreetMap contributors, ODbL. The app already shows this credit on the map.

## Places found in OpenStreetMap

| PRD name | OpenStreetMap name | Used as |
| --- | --- | --- |
| Jeepney Terminal | Butuan City Integrated Transport Terminal (125.53601, 8.95933) | Start of outbound, end of return. **Assumed** to be the terminal the route map means. |
| Rosales Ave | Jose Rosales Avenue | Outbound |
| JAQNO | Jose C. Aquino Avenue | Both |
| R. Calo St | South R. Calo Street (outbound), North R. Calo Street (return) | Both |
| T. Sanchez St | T. Sanchez Street | Outbound |
| M. Calo St | Marcos Calo Street | Outbound |
| Ampayon | Ampayon (place, 125.6025, 8.9613); the road there is where the Surigao-Butuan and Davao-Agusan national highways meet | Both |
| De Oro | De Oro (place, 125.6424, 8.9161), matching PRD stop DEO | End of outbound, start of return |
| R. Rosales St | Romulo A. Rosales Street | Return |
| North Montilla Blvd | North Montilla Boulevard | Return |

Between M. Calo and Ampayon the route was taken along the Surigao-Butuan National Highway, and between Ampayon and De Oro along the Davao-Agusan National Highway. The PRD does not name these roads; they are the main roads joining those places.

## Waypoints

One waypoint on each street, as `[longitude, latitude]`, in order:

```js
const OUT = [
  ['Jeepney Terminal', [125.53601, 8.95933]],
  ['Jose Rosales Ave', [125.53035, 8.94985]],
  ['JAQNO', [125.53515, 8.94691]],
  ['South R. Calo', [125.5413, 8.9455]],
  ['T. Sanchez', [125.5425, 8.94471]],
  ['M. Calo', [125.54415, 8.946]],
  ['Surigao-Butuan NH', [125.565, 8.954]],
  ['Ampayon', [125.603, 8.9614]],
  ['Davao-Agusan NH', [125.625, 8.945]],
  ['De Oro', [125.6438, 8.9165]],
];
const RET = [
  ['De Oro', [125.6438, 8.9165]],
  ['Davao-Agusan NH', [125.625, 8.945]],
  ['Ampayon', [125.603, 8.9614]],
  ['Surigao-Butuan NH', [125.565, 8.954]],
  ['JAQNO', [125.543, 8.94737]],
  ['North R. Calo', [125.54175, 8.9505]],
  ['R. Rosales St', [125.5415, 8.95163]],
  ['North Montilla Blvd', [125.53962, 8.95775]],
  ['Jeepney Terminal', [125.53601, 8.95933]],
];
```

The De Oro waypoint is on the Davao-Agusan National Highway about 160 m from PRD stop DEO, because DEO itself is off the highway.

## Streets the router used

Outbound, 18.4 km: (unnamed terminal road), Salvador Calo St, Eliza R. Ochoa Ave, Jorge Satorre St, Jose Rosales Ave, Jose C. Aquino Ave, South R. Calo St, T. Sanchez St, Marcos Calo St, Surigao-Butuan National Highway, Davao-Agusan National Highway.

Return, 16.8 km: Davao-Agusan National Highway, Surigao-Butuan National Highway, Jose C. Aquino Ave, North R. Calo St, Romulo A. Rosales St, North Montilla Blvd, Salvador Calo St, J.P. Laurel Ave, Andaya St, (unnamed terminal road).

## Things to check on a ride

1. Is the Integrated Transport Terminal the "Jeepney Terminal" of the route map?
2. Between the terminal and Jose Rosales Ave, the router chose Salvador Calo, Eliza R. Ochoa and Jorge Satorre streets. The PRD names no street for this part.
3. Between North Montilla Blvd and the terminal the router chose Salvador Calo St, J.P. Laurel Ave and Andaya St. The PRD names no street for this part either.
4. One-way rules come from OpenStreetMap's car data, which may not match what jeepneys do.

## Effect on stops

| Stop | Distance from outbound line | Distance from return line |
| --- | --- | --- |
| IMA | 1 m (on Jose Rosales Ave) | 1.1 km: not served |
| TSO | 2 m (on JAQNO) | 0.9 km: not served |
| JCA | 61 m | 2 m |
| RCA | 1 m | 8 m |
| MCA | 2 m | 11 m |
| DEO | 158 m | 158 m |

A stop is linked to a line when it is within `STATION_LINK_MAX_OFFSET_M` (200 m). The return path leaves JAQNO at R. Calo, so IMA and TSO are outbound only.

## Redoing it

The scripts are not kept in the repository. To redo the trace: send the waypoints above to `https://router.project-osrm.org/route/v1/driving/<lon,lat;...>?overview=full&geometries=geojson&steps=true&continue_straight=true`, round the returned coordinates to 6 decimals, paste them into the seed file and raise `ROUTE_DATA_VERSION`.

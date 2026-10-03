# Route 4 placeholder trace

How the Route 4 lines in `src/data/seed/r4.placeholder.ts` (route data version 2) were made, so they can be checked or redone. Done on 2026-10-03.

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

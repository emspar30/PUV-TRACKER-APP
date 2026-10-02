# Implementation Plan: Tunton APP (Commuter Client)

Source of truth: [PRD.md](PRD.md). Scope: Commuter Client only. Check off tasks as phases complete. Each phase ends with an Audit Report and requires explicit approval before the next begins.

## Locked Decisions

| Topic | Decision |
| --- | --- |
| Runtime | Custom Dev Client via `npx expo prebuild` (Expo Go bypassed: MapLibre and BLE need native code) |
| Route data | Placeholder straight-line GeoJSON in Butuan; real coordinates supplied later by the user |
| Route colors | R1 Red `#EF233C`, R2 Blue `#3B82F6`, R3 `#10B981`, R4 `#00F5D4`, R5 `#F97316`, R12 `#8B5CF6`, R14 `#EC4899` |
| Station nodes | Second SQLite table `route_stations`, seeded with 2-3 placeholder stations per route |
| Discount | 0.8 multiplier for Student, Senior Citizen, PWD; 1.0 for Regular |
| Tabs (exactly 5) | Tracker, Routes, Fare, CrowdFeed, Profile. Tracker and CrowdFeed are blank Bento layouts for now |
| Palette | Canvas `#0B0F17`, Surface `#161F30`; accents Cyan `#00F5D4`, Amber `#FFB703`, Crimson `#EF233C`, Emerald `#10B981`; text `#FFFFFF` primary, `#94A3B8` muted |
| Spacing | 8pt grid: 4, 8, 16, 24, 32; touch targets >= 48dp |
| Icons | `lucide-react-native` / `@expo/vector-icons` only. No emojis |

## Phase 1: Project Scaffold, Dependency Installation, UI Shell

- [ ] Initialize Expo + TypeScript (strict) project with Expo Router in the repo root
- [ ] Install all dependencies (Commuter and Driver) upfront:
  - Navigation/UI: `expo-router`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-screens`, `@gorhom/bottom-sheet`, `react-native-svg`, `lucide-react-native`, `@expo/vector-icons`
  - State/data: `zustand`, `@react-native-async-storage/async-storage`, `expo-sqlite`
  - Spatial/map: `@maplibre/maplibre-react-native`, `@turf/turf`
  - Hardware: `react-native-ble-plx`, `expo-location`, `expo-sensors`, `expo-task-manager`, `expo-device`, `expo-crypto`
  - Dev: `expo-dev-client`, `typescript`, `jest` + `jest-expo`
- [ ] Configure `app.json` plugins (expo-router, expo-sqlite, maplibre, ble-plx, expo-location permissions) and run `npx expo prebuild`
- [ ] Create theme tokens: colors, spacing (4/8/16/24/32), radii, typography, min touch target 48
- [ ] Build primitives: `Screen`, `BentoCard`, `BentoGrid`
- [ ] Bottom tab navigation with exactly 5 tabs (Tracker, Routes, Fare, CrowdFeed, Profile) using lucide icons
- [ ] Tracker and CrowdFeed: blank Bento layout screens
- [ ] Phase 1 Audit Report

## Phase 2: Onboarding and Profile State

- [ ] Zustand store (persisted): `classification`, `avatarId`, `onboarded`
- [ ] Classification picker: Regular, Student, Senior Citizen, Person with Disability
- [ ] Avatar picker: 12 preset vector avatars (no photo upload)
- [ ] Onboarding gate: first launch goes to onboarding, later launches go to tabs
- [ ] Profile tab: read-only avatar and classification
- [ ] `discountMultiplier` selector (0.8 for Student/Senior/PWD, 1.0 for Regular)
- [ ] Phase 2 Audit Report

## Phase 3: Offline SQLite and Route Discovery

- [ ] Create `franchise_routes` exactly per PRD 7.1
- [ ] Create `route_stations` (`id`, `route_id`, `station_name`, `latitude`, `longitude`)
- [ ] Seed Routes 1, 2, 3, 4, 5, 12, 14 with placeholder GeoJSON polylines and 2-3 placeholder stations each (idempotent, first launch only)
- [ ] Typed repository: `getAllRoutes()`, `getRouteById()`, `getStationsByRoute()`
- [ ] Routes tab: Bento grid of the seven routes with semantic color and ID
- [ ] `findBestRoute(origin, destination)` using `turf.pointToLineDistance()`; never throws offline
- [ ] Phase 3 Audit Report

## Phase 4: Dynamic LTFRB Fare Calculator

- [ ] Pure `computeFare(distanceKm, multiplier, baseFare, perKmRate)`: `(base + max(0, ceil(D - 4.0)) * rate) * M`
- [ ] Distance via `turf.lineSlice` + `turf.length` on the primary polyline between boarding and alighting stations (never the detour line)
- [ ] Read `base_fare` and `per_km_rate` from the SQLite row
- [ ] Fare tab: route selector, boarding/alighting station pickers, result card (distance, gross fare, discount, final fare)
- [ ] Unit tests: 4.0 km, 4.1 km, discounted case (6.3 km at 0.8 = 16.80)
- [ ] Phase 4 Audit Report

## Deferred (out of scope for Phases 1-4)

MapLibre rendering and offline tiles, blue-dot tracking, live tracker, station check-in, BLE relay, watchdogs, security protocols, tokenomics, cloud sync, 15-day cooldown, hardware fingerprinting, Driver client, SMS gateway.

## PRD Discrepancies Noted

- PRD Section 2 describes three system nodes, not a tab list. The 5-tab structure comes from the user's directive.
- The PRD names Cyan, Red, Green, Amber, and Blue only loosely as route/occupancy colors. The hex values come from the user's directive.
- Only R4 (`#00F5D4`) has a hex value in the PRD; all other route hex values, including Route 2 Blue `#3B82F6`, are final per the user's directive.

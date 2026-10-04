# Map labels plan (LB1)

- **Date:** 2026-10-04.
- **Status:** LB1a done (glyph proof, 2026-10-05, §7a). LB1b to LB1f not started.
- **Replaces** the earlier decision "no text labels in v0" (plan v2 Q7; S2).
- **Constraints (Emjay):**
  - offline;
  - no remote font or style URL;
  - no noticeable performance loss;
  - clean and minimal UI;
  - Light and Dark;
  - no native change.

## 1. What the current tile file contains

- **Method:** read-only decode of `assets/map/butuan.pmtiles` (Protomaps basemap 4.15.2, OpenStreetMap). A scratch reader used Node's built-in `zlib`; nothing was installed or written.
- **Header:** PMTiles v3, vector tiles (MVT), gzip, zoom 0 to 14.
- **Name fields:** every named layer has `name`, plus `name:en` and other languages, `name2` and `name3`.
- **Sample:** a 3 x 3 block of tiles around Butuan city centre (125.54, 8.95).

| Layer | z11 | z12 | z13 | z14 | Named kinds (examples) |
| --- | --- | --- | --- | --- | --- |
| `places` | 297 named | 384 | 113 | 63 | `locality` (Butuan, Masao, Santo Niño), `macrohood` (Imadejas, Bayanihan, Holy Redeemer), `neighbourhood` (Doongan, "Purok 2", "Purok 7") |
| `roads` | 0 named | 98 named (major) | 118 (major) | 241 (107 major, 133 minor) | Jose C. Aquino Avenue, Jose Rosales Avenue, Salvador Calo Street |
| `pois` | 16 | 42 | 125 | 254 | 17 schools, 15 places of worship, 6 hospitals, 2 bus stations, banks, hotels, 66 named residential areas |
| `water` | 28 rivers | 17 | 17 | 12 | Agusan River, Masao River |
| `buildings` | 3 | — | — | many | **No building has a name** |

**Barangay names.**
- Barangays appear as `locality`, `macrohood` or `neighbourhood` places, depending on how they were mapped in OpenStreetMap.
- There is no separate "barangay" kind; the plan treats all three as barangay-level names.

**Purok names.**
- Across the whole box at z14 (108 tiles), **39 names contain "Purok"**, as `neighbourhood`.
- That covers only a fraction of the city's puroks. The gap is filled by Emjay's own names layer (§4).

**Building names.**
- **None** in `buildings`.
- Named buildings exist only as POIs (schools, hospitals, terminals, malls, banks).
- Markets were not seen in the sample (**unverified**: a full scan is part of LB1c).

**What a zoom-15 file would add** (not yet available; **unverified** until Emjay's file exists):
- POIs and roads whose Protomaps `min_zoom` is 15 (smaller amenities, service roads, paths);
- finer building shapes.

Names for places and major roads are already complete at z14. Text at z15 and above is drawn from the deepest tiles by overzoom.

## 2. Glyphs (fonts)

| Item | Proposal |
| --- | --- |
| Source | Protomaps "basemaps-assets" glyph PBFs of **Noto Sans** (Regular and Medium). The same font family Protomaps styles use. |
| Licence | **SIL Open Font License 1.1** (Noto). Free to bundle in an app; the licence text ships with the files. **To be confirmed by Emjay before any download.** |
| Ranges | `0-255` (Basic Latin and Latin-1: covers English, Filipino and Cebuano, including ñ and Ñ); `256-511` (Latin Extended-A, for stray accents in OSM names); `8192-8447` (punctuation such as ’ “ ” –) |
| Size | About 3 ranges x 2 weights, roughly 50 to 90 KB each: **about 0.3 to 0.5 MB** (estimate; measured at download) |
| Delivery | Bundled assets copied once at first launch to the app's files folder, like the tile file: a versioned folder name (`glyphs-v1`), a size check per file, and re-copy when the version changes. Needs `pbf` added to Metro's `assetExts` (a JavaScript config change, not native). |
| Style | `glyphs: "file:///<files>/glyphs-v1/{fontstack}/{range}.pbf"` with `text-font: ["Noto Sans Regular"]`. No remote URL. |
| Resolution on Android | MapLibre Native reads `file://` URLs for glyphs. **Unverified** for MapLibre React Native 11 on this build, so it is proven first. |
| Proof test (LB1a) | Like the PMTiles format test: copy one range, add one symbol layer that prints "Butuan" at the city centre, and look on the emulator in Light and Dark. Pass means text draws with no network. Fail means stop and report (fallback: `asset://` through a config plugin, which is a native change and needs approval). |

## 3. Zoom tiers (config constants)

| Constant | Value | Data |
| --- | --- | --- |
| `LABEL_CITY_MIN_ZOOM` | 11 | `places` `locality` with high `pmap:rank` / population |
| `LABEL_BARANGAY_MIN_ZOOM` | 13 | `places` `macrohood`, `neighbourhood` and remaining `locality` |
| `LABEL_MAJOR_ROAD_MIN_ZOOM` | 13 | `roads` `major_road` (named from z12) |
| `LABEL_STREET_MIN_ZOOM` | 15 | `roads` `minor_road` (in the z14 tiles; shown from 15 by overzoom) |
| `LABEL_POI_MIN_ZOOM` | 16 | `pois` of kinds school, college, hospital, bus_station, marketplace, mall, townhall (allowlist) |
| `LABEL_OWN_PLACES_MIN_ZOOM` | 15 (per feature `minZoom` may raise it) | Emjay's names layer (§4) |

- **With tiles stopping at z14:** z15 to z18 overzoom the z14 tiles, so street and POI names still exist; their density only looks lower. Nothing is lost by the tiers.
- **With z15 tiles:** the same tiers apply, and a few more POIs appear from z15 to 16.

## 4. Emjay's own names layer

| Item | Proposal |
| --- | --- |
| Source file | `assets/data/places.geojson`: Point features, `properties: { name, kind, minZoom? }`. `kind` is one of `purok`, `building`, `landmark`, `market`, `terminal`, `school`. |
| Import | `scripts/import-places.ts`, in the style of the route import: validate longitude and latitude near Butuan, bounds warnings, a maximum of 2,000 points, unique names per kind, trimmed text. Dry run by default; `--write` writes `src/data/seed/places.generated.ts`. |
| Drawing | One `GeoJSONSource` plus a symbol layer above the OSM labels, with its own minimum zoom per kind. Where an OSM label and an own label say the same thing, the own label wins (higher sort key). |
| Privacy | Names only, no people; the data stays offline |

## 5. Visual rules

| Rule | How |
| --- | --- |
| Small text with a halo | 11 to 12 dp for streets, 12 to 13 for barangays, 13 to 14 for the city; a 1.5 dp halo in the map's land colour |
| Theme-aware colours | New tokens `labelText`, `labelHalo` and `labelMuted` (POI and street) in `MAP_PAINTS` for Light and Dark. The contrast test checks the text against its halo at 4.5:1. |
| Priorities | `symbol-sort-key` by tier: city, then barangay, then major road, own places, POI, then street. MapLibre's collision detection drops lower ones first (`text-allow-overlap: false`, `text-padding` 4). |
| Count per screen | No direct setting exists; density is held by the tiers, padding and road label spacing (`symbol-spacing` 300). Target: at most about 20 labels on a phone screen (measured with a debug count of rendered features). |
| Route lines stay clear | Label layers sit **below** the route line layers, so a route is never covered. The sheet and the route chips are native views over the map, so text never covers them. |
| Fade when a route is selected | Label text opacity drops to `LABEL_DIMMED_OPACITY` (0.5) while a route is selected, then returns |
| No text on the map otherwise | Stops, vehicles and pins keep their no-text design |
| Settings switch | "Map labels", default **on**, stored on the device in the settings store. Off removes the symbol layers entirely. |

## 6. Performance plan

| Item | Plan |
| --- | --- |
| Budgets | No visible pan or zoom stutter on the emulator; frame times not worse than the RR1 "after" values by more than about 10 %; app size +0.5 MB at most; first-launch copy under 300 ms |
| Measure (before and after) | The RR1 `gfxinfo` method (UI thread). **Also** `adb shell dumpsys SurfaceFlinger --latency` on the map's surface, which measures the MapLibre GL frames that `gfxinfo` does not see. Layer counts before and after. Repeated on the partner's phone. |
| Memory | `adb shell dumpsys meminfo com.tunton.app` before and after, with labels on and off |
| Fallback | Fewer label layers (merge POIs into one); higher minimum zooms (streets from 16); drop the 256 to 511 glyph range; the Settings switch off by default |

## 7. Steps

| Step | Goal | Acceptance | Tests | Native? | Effort |
| --- | --- | --- | --- | --- | --- |
| **LB1a** Glyph proof | Text draws offline from a local glyph file | "Butuan" visible at z11 in Light and Dark with networking off; no remote URL in the style | Unit: the style has no `http(s)` URL and its glyph URL is `file://`; manual `LB1a-M1` | No (Metro `assetExts` only) | Small |
| **LB1b** Places and roads | City, barangay and road names by tier | Tiers as §3; Light and Dark contrast 4.5:1 text on halo; labels below route lines | Unit: style layer order, minzoom per tier, tokens in the contrast test; manual `LB1b-M1` at z11, 13, 15 | No | Medium |
| **LB1c** POIs | Schools, hospitals, terminals, markets from z16 | Allowlist only; full-box scan of kinds recorded | Unit: allowlist filter in the style; manual | No | Small |
| **LB1d** Own names layer | Emjay's puroks and buildings | Import script validates; layer draws above OSM labels from its `minZoom` | Unit tests for the import; manual | No | Medium |
| **LB1e** Switch and fade | "Map labels" setting; fade on route select | Off removes the layers; selection dims to 0.5 | Unit: visibility rule; manual | No | Small |
| **LB1f** Performance | Before and after numbers | Within the §6 budgets on the emulator; partner's phone queued | Manual, recorded in `device-tests.md` | No | Small |

## 7a. LB1a record (2026-10-05)

**Approved by Emjay** ("download approved"): only these 6 files, Noto Sans under the SIL OFL 1.1.

| File (in `assets/glyphs/glyphs-v1/`) | Source URL | HTTP | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| `Noto Sans Regular/0-255.pbf` | `https://protomaps.github.io/basemaps-assets/fonts/Noto%20Sans%20Regular/0-255.pbf` | 200 | 76,044 | `62c6d49b15fa836eb6aa45e259c7ca6762f44b011b09e47776efbe4a6db1b397` |
| `Noto Sans Regular/256-511.pbf` | `…/Noto%20Sans%20Regular/256-511.pbf` | 200 | 127,726 | `2eca7561f9f566bcacfda5dd04fb5880baec1328ec0f5484678289a13994de8a` |
| `Noto Sans Regular/8192-8447.pbf` | `…/Noto%20Sans%20Regular/8192-8447.pbf` | 200 | 64,220 | `8ea977a587352fe31b4159ffdbc9a40be79056f2472017c742ea1e4a931864b9` |
| `Noto Sans Medium/0-255.pbf` | `…/Noto%20Sans%20Medium/0-255.pbf` | 200 | 77,628 | `ba2f0118dd024e3041b158e5f9eb49bc0a658019f53f458e9f5c0b8efcd79b91` |
| `Noto Sans Medium/256-511.pbf` | `…/Noto%20Sans%20Medium/256-511.pbf` | 200 | 129,635 | `d5e801a1a5b1d409d3298c3a1e1ca76328e2314a751078833a618620e8e66e4d` |
| `Noto Sans Medium/8192-8447.pbf` | `…/Noto%20Sans%20Medium/8192-8447.pbf` | 200 | 65,101 | `cc38e4956207f0edba1aaf749b61e8f6f1678ef1ad443d32ee285b21d0eb67aa` |
| `OFL.txt` (licence) | `https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts/OFL.txt` (the `fonts/` directory of the repository, found through the GitHub contents API) | 200 | 4,374 | `7713cfc8e3c36d5ec4aa3d6cffe7500a1b3310f8a86d914b8ea09c2a9dee7c2d` |

- **Total:** 540,354 bytes of glyphs (0.54 MB), slightly above the §6 budget of 0.5 MB. Dropping `256-511` (Latin Extended-A) would save 257 KB if needed.
- **Decode check** (scratch Node script, no library): every file is a glyph protobuf with one font stack, the expected range, and 193 to 256 glyphs. **One mismatch, accepted by Emjay:** the font name stored inside is `Sans Regular` and `Sans Medium`, not `Noto Sans Regular` and `Noto Sans Medium`. MapLibre picks the file by the folder name in the URL, and the device test below drew text, so the inner name does not matter.
- **Licence:** the full text is in `assets/glyphs/glyphs-v1/OFL.txt` (Copyright 2022 The Noto Project Authors). About shows "Map labels use Noto Sans, SIL Open Font License 1.1". The `.txt` file is kept in the repository beside the fonts; it is **not** inside the app package (Metro does not bundle `.txt`).
- **Install:** at start-up, after the tile file, the six files are copied from the bundle to `<files>/glyphs/glyphs-v1/<font>/<range>.pbf` through a `.part` name with a size check per file; older `glyphs-v*` folders are removed. A failure leaves the map without text and never blocks it. Code: `src/shared/map/glyphInstall.ts` (tested), `src/features/map/glyphs.ts`, facts in `src/data/map/glyphset.ts`.
- **Style:** `glyphs: "file:///data/user/0/com.tunton.app/files/glyphs/glyphs-v1/{fontstack}/{range}.pbf"`. Folder names **with spaces work**; no rename was needed.
- **Result:** pass. See `device-tests.md` (LB1a-M1). First-launch copy 1,991 ms in a development build (each file fetched from Metro; a release build reads them from the APK, unverified); later launches 26 ms. The test label stays in the code, development builds only, behind `MAP_LABEL_PROOF_DEV` (now `false`).

## 8. Questions

| # | Question | Blocks |
| --- | --- | --- |
| 1 | Approve Noto Sans glyphs from Protomaps basemaps-assets under the SIL OFL 1.1, and the three ranges? | LB1a (any download) |
| 2 | Which name field: `name` (the local name as mapped, often Cebuano or Filipino) or `name:en` when present? | LB1b |
| 3 | Is a Metro `assetExts` change for `pbf` acceptable (a JavaScript config file, no native change)? | LB1a |
| 4 | Labels drawn **under** the route lines (never covering them): acceptable? | LB1b |
| 5 | Which POI kinds to show (proposed: school, college, hospital, bus station, market, mall, town hall)? | LB1c |
| 6 | Will you supply `places.geojson` (puroks, buildings) and in what form (My Maps export like the routes)? | LB1d |

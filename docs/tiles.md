# Offline map tiles

## Current: v2 (2026-10-05)

| Item | Value |
| --- | --- |
| File | `assets/map/butuan_v2.pmtiles`, made by Emjay |
| Facts (`pmtiles show`, checked against the header by `offlineMap.test.ts`) | 3,674,024 bytes; PMTiles spec 3; `mvt`, gzip; bounds west 125.45, south 8.85, east 125.70, **north 9.07**; centre 125.575, 8.96; **zoom 0 to 15**; 732 addressed tiles, 700 entries; Protomaps basemap 4.15.2 (build 20261002), the same schema as v1 |
| Constants | `src/data/map/tileset.ts`: version 2, size, bounds, max zoom 15. The map zooms 4 levels past the tiles (to 19). The pan limits and the opening view use the same bounds. |
| On the phone | Installed as `butuan.v2.pmtiles` by the existing versioned copy: copied under a temporary name, size-checked, renamed; an older `butuan.v1.pmtiles` is removed only after v2 is in place |
| Coverage | Every point of R3, R4 and R5 is inside (R5's northern end, up to 9.033, was outside v1) |
| v1 | `assets/map/butuan.pmtiles` (1,775,640 bytes, north 9.02, zoom 0 to 14) removed from the bundle; it stays in git history |
| Labels | The schema has names (`places`, `roads`, `pois`); see `docs/LABELS_PLAN.md` |

## History: v1, the placeholder for S2

How to make the small offline tile set for the Butuan area. You run these steps once, on your PC, before S2 starts. The result is one file, `butuan.pmtiles`.

**Status:** these steps produce a PMTiles file. Whether MapLibre React Native 11 reads a local PMTiles file on Android is the first thing S2 tests. If it only reads `.mbtiles` (the format named in PRD 7.2), the same data is converted then; you will not need to download it again.

**Done on 2026-10-03:** the steps were run with `pmtiles` 1.31.2 and the `20261002` build. The result is `assets/map/butuan.pmtiles` (1.8 MB, 173 tiles). On the release page, take the file whose name contains `Windows_x86_64`; the `Darwin` files are for macOS.

**Decisions already made:** no text labels in v0, so no font files are needed.

## What you get

- Source: the Protomaps daily basemap build, which is made from OpenStreetMap data.
- Area: longitude 125.45 to 125.70, latitude 8.85 to 9.02. This covers every Route 4 placeholder point (PRD 12.5) with margin.
- Zoom levels: 0 to 14. Level 14 shows street-level detail; MapLibre can zoom in further by stretching it.
- Expected size: a few megabytes. The exact size is unknown until the extract runs.

## Steps

1. **Download the `pmtiles` tool.**
   - Open https://github.com/protomaps/go-pmtiles/releases
   - Under the newest release, download the Windows 64-bit archive (the file name contains `Windows_x86_64`).
   - Unzip it. You get `pmtiles.exe`. Put it in a folder you can find, for example `C:\tools\pmtiles\`.

2. **Find a recent build date.**
   - Open https://maps.protomaps.com/builds/
   - Note the newest build's date as eight digits, for example `20261001`.

3. **Extract the Butuan area.** In PowerShell, in the folder that holds `pmtiles.exe`, run this with your build date in place of `YYYYMMDD`:

   ```powershell
   .\pmtiles.exe extract https://build.protomaps.com/YYYYMMDD.pmtiles butuan.pmtiles --bbox=125.45,8.85,125.70,9.02 --maxzoom=14
   ```

   The bounding box order is west, south, east, north. The tool downloads only the tiles inside the box, not the whole planet file.

4. **Check the result.**

   ```powershell
   .\pmtiles.exe show butuan.pmtiles
   ```

   Expect: tile type `mvt`, max zoom 14, and bounds matching the box above.

5. **Look at it (optional).** Open https://pmtiles.io and drag `butuan.pmtiles` onto the page. You should see Butuan's streets and the river.

6. **Put the file in the project.** Create the folder `assets\map\` in the project and copy `butuan.pmtiles` into it. Tell me the file size when S2 starts.

## Attribution

OpenStreetMap data is under the Open Database License (ODbL), which requires credit. The app must show "© OpenStreetMap contributors" on or near the map. S2 adds this line to the map screen.

## Not verified yet

- I have not run these commands on this machine.
- The Windows archive's exact file name changes with each release.
- PMTiles support in MapLibre React Native 11 on Android is untested in this project (see Status above).

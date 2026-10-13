import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type StyleSpecification,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { Captions, CaptionsOff, Maximize, Minus, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type NativeSyntheticEvent } from 'react-native';

import { RoundButton } from '@/components/RoundButton';
import { GLYPH_FONT_MEDIUM } from '@/data/map/glyphset';
import { buildOfflineStyle } from '@/data/map/offlineStyle';
import { TILESET } from '@/data/map/tileset';
import { prepareOfflineTiles } from '@/data/offline/tiles';
import { DRIVER_MAP_DETAIL_ZOOM, DRIVER_MAP_MAX_ZOOM_IN, DRIVER_MAP_ZOOM_STEP, MAP_OVERZOOM_LEVELS } from '@/shared/config';
import type { HeatmapRow } from '@/shared/driver/heatmapView';
import { northCenterCap, type Bounds } from '@/shared/geo/bounds';
import { fitCamera, latAboveCenter, zoomAbout, type Size } from '@/shared/geo/fit';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

import type { DriverRoute } from './routeStops';

// DR5: the driver's map (PRD 9.4): the bundled offline tiles and a glowing node per stop, sized and
// coloured by its band. Unknown stops are small grey dots; a stale heatmap is all grey, its route
// line faded (Stitch 3.2). If the map cannot load, the list still works alone (plan risk R8).
// Owner's decision 2026-10-14 (it replaces "framed once, no gestures"): the map fills the screen
// under the floating panels, each stop is named, and it may be dragged and zoomed. Its centre stays
// over the offline tiles (Butuan), so it never shows another town. Owner, 2026-10-14 (later passes):
// the default view (the route framed in the space the panels leave) is worked out from the screen
// (shared/geo/fit.ts), not read back from the map, and is the furthest it zooms out; it zooms in at
// most DRIVER_MAP_MAX_ZOOM_IN levels more; the top of the screen never passes the tiles' north edge
// (the other edges stay under the panels). Round buttons zoom in and out and bring back the default
// view in one tap. Zoomed in past DRIVER_MAP_DETAIL_ZOOM, each node shows its count (or its band at
// night). Nothing needs a tap: untouched, the map stays on the default view.
// Owner, 2026-10-14: a round button under the reset button hides the stop names on the
// default view (busy downtown names can cover the dots); zoomed in to the counts, names always show.

type TilesState = { status: 'preparing' } | { status: 'ready'; url: string; glyphsUrl: string | null } | { status: 'error' };

// Node sizes by band index (0 to 3), in dp, and the glow around them
const CORE_RADIUS = [5, 8, 11, 14];
const UNKNOWN_RADIUS = 4;
// Zoomed in, every node is a disc big enough for its count
const DETAIL_RADIUS = 15;
const GLOW_SCALE = 2.2;
const GLOW_OPACITY = 0.45;
const LINE_WIDTH = 4;
const LINE_OPACITY = 0.6;
const STALE_LINE_OPACITY = 0.3;
const NAME_SIZE = 14;
const NAME_MAX_WIDTH_EM = 8;
const COUNT_SIZE = 13;
const HALO_WIDTH = 1.5;
// The name sits beside the node, this many text heights from its centre
const NAME_OFFSET_EM = 1.1;
const DETAIL_NAME_OFFSET_EM = 1.6;
const FRAME_MARGIN = spacing.lg;
// Wider at the sides, so names beside the end stops stay on the screen
const SIDE_MARGIN = spacing.xl * 2;
// The column of round buttons on the right, kept clear when the route is framed
const BUTTONS_WIDTH = spacing.md + spacing.xl + spacing.md;
// A zoom this close to its aim counts as reached
const ZOOM_EPSILON = 0.01;
// A new camera limit (maxBounds) stops any camera animation when it reaches the map, and a camera
// command can reach the map before a prop change made in the same render; a button's move waits this
// long, so the limit for its zoom lands first
const MOVE_AFTER_LIMIT_MS = 60;

function useDriverTiles(): TilesState {
  const [state, setState] = useState<TilesState>({ status: 'preparing' });
  useEffect(() => {
    let cancelled = false;
    prepareOfflineTiles()
      .then((tiles) => {
        if (!cancelled) setState({ status: 'ready', url: tiles.url, glyphsUrl: tiles.glyphsUrl });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

type Props = {
  route: DriverRoute;
  rows: readonly HeatmapRow[];
  stale: boolean;
  // Heights of the floating panels over the top and bottom of the map: the route is framed between them
  topInset: number;
  bottomInset: number;
};

export function HeatmapMap({ route, rows, stale, topInset, bottomInset }: Props) {
  const styles = useStyles();
  const { baseMap, colors, mapPaint, mapRoute, routeColor, typography } = useTheme();
  const tiles = useDriverTiles();
  const camera = useRef<CameraRef>(null);
  const [size, setSize] = useState<Size | null>(null);
  // Where the map last said it was, and where the buttons last sent it (several quick taps add up)
  const view = useRef<{ zoom: number; center: [number, number] } | null>(null);
  const aim = useRef<{ zoom: number; center: [number, number] } | null>(null);
  // The driver moved the map: a panel changing size no longer moves it back
  const moved = useRef(false);
  const [detail, setDetail] = useState(false);
  const [namesHidden, setNamesHidden] = useState(false);
  // The highest the camera centre may go, so the top of the screen stays on the tiles
  const [northCap, setNorthCap] = useState<number | null>(null);
  // A button's move, made after the render that set the limit for its zoom (the old limit would
  // clamp it)
  const [move, setMove] = useState<{ zoom: number; center: [number, number]; key: number } | null>(null);

  const mapStyle = useMemo(
    () => (tiles.status === 'ready' ? (buildOfflineStyle(tiles.url, baseMap, tiles.glyphsUrl) as unknown as StyleSpecification) : null),
    [tiles, baseMap],
  );
  // Text on the map needs the installed glyphs; without them the nodes still show, unnamed
  const named = tiles.status === 'ready' && tiles.glyphsUrl !== null;

  const stripRight = Math.max(SIDE_MARGIN, BUTTONS_WIDTH + FRAME_MARGIN);
  // The default view: the route in the space the panels and the buttons leave
  const fit = useMemo(
    () =>
      size && route.bounds
        ? fitCamera(route.bounds, size, {
            top: topInset + FRAME_MARGIN,
            bottom: bottomInset + FRAME_MARGIN,
            left: SIDE_MARGIN,
            right: stripRight,
          })
        : null,
    [size, route.bounds, topInset, bottomInset, stripRight],
  );
  const maxZoom = fit ? Math.min(fit.zoom + DRIVER_MAP_MAX_ZOOM_IN, TILESET.maxZoom + MAP_OVERZOOM_LEVELS) : null;

  const showDefaultView = () => {
    if (!fit) return;
    moved.current = false;
    aim.current = null;
    camera.current?.easeTo({ center: fit.center, zoom: fit.zoom, duration: mapRoute.cameraAnimationMs });
  };

  // A panel grew or shrank (a warning appeared): back to the new default view, unless the driver moved the map
  useEffect(() => {
    if (!moved.current) showDefaultView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit]);

  // The limit at a zoom: the top of the screen on the tiles' north edge, the default view always allowed
  const capFor = (centerLat: number, zoom: number) =>
    northCenterCap(TILESET.bounds, size ? latAboveCenter(centerLat, zoom, size.height) : 0, fit ? fit.center[1] : centerLat);

  // The buttons zoom about the middle of the strip of map between the panels, not the screen's
  // middle (under the list), so what the driver sees stays in view
  const zoomBy = (levels: number) => {
    if (!fit || maxZoom === null) return;
    moved.current = true;
    const from = aim.current ?? view.current ?? fit;
    const zoom = Math.min(Math.max(from.zoom + levels, fit.zoom), maxZoom);
    const center = zoomAbout(from.center, from.zoom, zoom, { x: (SIDE_MARGIN - stripRight) / 2, y: (topInset - bottomInset) / 2 });
    aim.current = { zoom, center };
    if (size) setNorthCap(capFor(center[1], zoom));
    setMove((last) => ({ zoom, center, key: (last?.key ?? 0) + 1 }));
  };

  useEffect(() => {
    if (!move) return undefined;
    const timer = setTimeout(
      () => camera.current?.easeTo({ center: move.center, zoom: move.zoom, duration: mapRoute.cameraAnimationMs }),
      MOVE_AFTER_LIMIT_MS,
    );
    return () => clearTimeout(timer);
  }, [move, mapRoute.cameraAnimationMs]);

  const onRegionDidChange = (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const { zoom, center, userInteraction } = event.nativeEvent;
    view.current = { zoom, center: [center[0], center[1]] };
    if (userInteraction || (aim.current !== null && Math.abs(zoom - aim.current.zoom) < ZOOM_EPSILON)) aim.current = null;
    if (!fit || !size) return;
    setDetail(zoom >= fit.zoom + DRIVER_MAP_DETAIL_ZOOM);
    // Not while a button's move is under way: its limit is already set for where it is going
    if (aim.current === null) setNorthCap(capFor(center[1], zoom));
  };

  const [west, south, east] = TILESET.bounds;
  const maxBounds: Bounds = northCap !== null ? [west, south, east, northCap] : TILESET.bounds;

  const nodes = useMemo<FeatureCollection<Point>>(() => {
    const bandColors = [mapPaint.stop, mapPaint.occupancyGreen, mapPaint.occupancyAmber, mapPaint.occupancyRed];
    const byCode = new globalThis.Map(rows.map((row) => [row.code, row.display]));
    const text = strings.driver.heatmap;
    return {
      type: 'FeatureCollection',
      features: route.stops.map((stop) => {
        const display = byCode.get(stop.code);
        const known = display?.kind === 'known' ? display : null;
        const band = known ? known.band : 0;
        const grey = stale || !known;
        return {
          type: 'Feature',
          properties: {
            name: stop.name,
            color: grey ? mapPaint.stale : bandColors[band],
            radius: detail ? DETAIL_RADIUS : known ? CORE_RADIUS[band] : UNKNOWN_RADIUS,
            // Only a fresh count above zero glows
            glow: !grey && band > 0,
            // The exact count by day, the band at night (Q11), a dash before the first count
            count: known ? (known.exact !== null ? String(known.exact) : text.bands[band]) : text.unknown,
            // The white node of a fresh 0 takes dark text; every other fill takes white
            countColor: !grey && band === 0 ? colors.textPrimary : colors.onPrimary,
            // Busier stops keep their name when names collide
            priority: -band,
          },
          geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] },
        };
      }),
    };
  }, [route, rows, stale, detail, mapPaint, colors]);

  const lines = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: route.lines.map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })),
    }),
    [route],
  );

  if (tiles.status === 'error' || !route.bounds) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <Text style={typography.bodyMd}>{strings.driver.heatmap.mapUnavailable}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={({ nativeEvent: { layout } }: LayoutChangeEvent) => setSize({ width: layout.width, height: layout.height })}>
      {mapStyle && fit && maxZoom !== null ? (
        <Map
          style={styles.fill}
          mapStyle={mapStyle}
          logo={false}
          attribution={false}
          compass={false}
          doubleTapZoom={false}
          doubleTapHoldZoom={false}
          touchRotate={false}
          touchPitch={false}
          onRegionWillChange={(event) => {
            if (event.nativeEvent.userInteraction) moved.current = true;
          }}
          onRegionDidChange={onRegionDidChange}
        >
          <Camera
            ref={camera}
            initialViewState={{ center: fit.center, zoom: fit.zoom }}
            minZoom={fit.zoom - ZOOM_EPSILON}
            maxZoom={maxZoom}
            maxBounds={maxBounds}
          />
          <GeoJSONSource id="driver-route" data={lines}>
            <Layer
              key="driver-route-line"
              id="driver-route-line"
              type="line"
              paint={{
                'line-color': stale ? mapPaint.stale : routeColor(route.routeCode, route.color),
                'line-width': LINE_WIDTH,
                'line-opacity': stale ? STALE_LINE_OPACITY : LINE_OPACITY,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
          {/* Each layer has a key: the count layer comes and goes with the zoom, and MapLibre
              refuses a layer whose id changes in place */}
          <GeoJSONSource id="driver-nodes" data={nodes}>
            <Layer
              key="driver-node-glow"
              id="driver-node-glow"
              type="circle"
              filter={['get', 'glow']}
              paint={{
                'circle-radius': ['*', ['get', 'radius'], GLOW_SCALE],
                'circle-color': ['get', 'color'],
                'circle-opacity': GLOW_OPACITY,
                'circle-blur': 1,
              }}
            />
            <Layer
              key="driver-node"
              id="driver-node"
              type="circle"
              paint={{
                'circle-radius': ['get', 'radius'],
                'circle-color': ['get', 'color'],
                'circle-stroke-color': mapPaint.stopStroke,
                'circle-stroke-width': 1,
              }}
            />
            {named && detail ? (
              <Layer
                key="driver-node-count"
                id="driver-node-count"
                type="symbol"
                layout={{
                  'text-field': ['get', 'count'],
                  'text-font': [GLYPH_FONT_MEDIUM],
                  'text-size': COUNT_SIZE,
                  'text-allow-overlap': true,
                  'text-ignore-placement': true,
                }}
                paint={{ 'text-color': ['get', 'countColor'] }}
              />
            ) : null}
            {named && (detail || !namesHidden) ? (
              <Layer
                key="driver-node-name"
                id="driver-node-name"
                type="symbol"
                layout={{
                  'text-field': ['get', 'name'],
                  'text-font': [GLYPH_FONT_MEDIUM],
                  'text-size': NAME_SIZE,
                  'text-max-width': NAME_MAX_WIDTH_EM,
                  'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
                  'text-radial-offset': detail ? DETAIL_NAME_OFFSET_EM : NAME_OFFSET_EM,
                  'text-justify': 'auto',
                  'symbol-sort-key': ['get', 'priority'],
                }}
                paint={{ 'text-color': colors.textPrimary, 'text-halo-color': baseMap.land, 'text-halo-width': HALO_WIDTH }}
              />
            ) : null}
          </GeoJSONSource>
        </Map>
      ) : null}
      <Text style={[typography.caption, styles.credit, { bottom: bottomInset + spacing.sm }]}>{strings.common.attribution}</Text>
      <View style={[styles.buttons, { bottom: bottomInset + spacing.sm }]}>
        <RoundButton icon={Plus} label={strings.driver.heatmap.zoomIn} onPress={() => zoomBy(DRIVER_MAP_ZOOM_STEP)} />
        <RoundButton icon={Minus} label={strings.driver.heatmap.zoomOut} onPress={() => zoomBy(-DRIVER_MAP_ZOOM_STEP)} />
        <RoundButton icon={Maximize} label={strings.driver.heatmap.defaultView} onPress={showDefaultView} />
        {named ? (
          <RoundButton
            icon={namesHidden ? Captions : CaptionsOff}
            label={namesHidden ? strings.driver.heatmap.showNames : strings.driver.heatmap.hideNames}
            onPress={() => setNamesHidden((hidden) => !hidden)}
          />
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.canvas,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  credit: {
    position: 'absolute',
    left: spacing.md,
  },
  buttons: {
    position: 'absolute',
    right: spacing.md,
    gap: spacing.sm + spacing.xs,
  },
}));

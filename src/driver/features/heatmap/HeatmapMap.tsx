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
import { Maximize, Minus, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';

import { RoundButton } from '@/components/RoundButton';
import { GLYPH_FONT_MEDIUM } from '@/data/map/glyphset';
import { buildOfflineStyle } from '@/data/map/offlineStyle';
import { TILESET } from '@/data/map/tileset';
import { prepareOfflineTiles } from '@/data/offline/tiles';
import { DRIVER_MAP_DETAIL_ZOOM, DRIVER_MAP_MIN_ZOOM, DRIVER_MAP_ZOOM_STEP, MAP_OVERZOOM_LEVELS, MAP_VIEW_STEP_DEG } from '@/shared/config';
import type { HeatmapRow } from '@/shared/driver/heatmapView';
import { northCenterCap, type Bounds } from '@/shared/geo/bounds';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

import type { DriverRoute } from './routeStops';

// DR5: the driver's map (PRD 9.4): the bundled offline tiles and a glowing node per stop, sized and
// coloured by its band. Unknown stops are small grey dots; a stale heatmap is all grey, its route
// line faded (Stitch 3.2). If the map cannot load, the list still works alone (plan risk R8).
// Owner's decision 2026-10-14 (it replaces "framed once, no gestures"): the map fills the screen
// under the floating panels, each stop is named, and it may be dragged and zoomed. Its centre stays
// over the offline tiles (Butuan), so it never shows another town. Owner, 2026-10-14 (second pass):
// it never zooms out past the default view, and never shows the blank past the tiles' north edge at
// the top of the screen (the other edges stay under the panels). Round buttons zoom in and out and bring back the
// default view (the route framed in the space the panels leave). Zoomed in past
// DRIVER_MAP_DETAIL_ZOOM, each node shows its count (or its band at night). Nothing needs a tap:
// untouched, the map stays on the default view.

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
  // The zoom of the default view, known from its first camera report; counts show above it
  const defaultZoom = useRef<number | null>(null);
  const zoom = useRef<number | null>(null);
  // Set while the camera moves to the default view, so its zoom is taken as the default
  const framing = useRef(true);
  // The driver moved the map: a panel changing size no longer moves it back
  const moved = useRef(false);
  const [detail, setDetail] = useState(false);
  // Set from the default view once it is reached: the smallest zoom, and the highest the centre may
  // go; null while the camera frames the route (the limits would hold it back)
  const [limits, setLimits] = useState<{ minZoom: number; northCap: number; keepLat: number } | null>(null);
  // Each new value frames the route again, after the limits are released
  const [fitKey, setFitKey] = useState(0);

  const mapStyle = useMemo(
    () => (tiles.status === 'ready' ? (buildOfflineStyle(tiles.url, baseMap, tiles.glyphsUrl) as unknown as StyleSpecification) : null),
    [tiles, baseMap],
  );
  // Text on the map needs the installed glyphs; without them the nodes still show, unnamed
  const named = tiles.status === 'ready' && tiles.glyphsUrl !== null;

  const padding = {
    top: topInset + FRAME_MARGIN,
    bottom: bottomInset + FRAME_MARGIN,
    left: SIDE_MARGIN,
    right: Math.max(SIDE_MARGIN, BUTTONS_WIDTH + FRAME_MARGIN),
  };

  const showDefaultView = () => {
    framing.current = true;
    moved.current = false;
    setLimits(null);
    setFitKey((key) => key + 1);
  };

  // Runs after the render that released the limits, so the camera may reach the default view
  useEffect(() => {
    if (fitKey === 0 || !route.bounds) return;
    camera.current?.fitBounds(route.bounds, { padding, duration: mapRoute.cameraAnimationMs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // A panel grew or shrank (a warning appeared): frame the route again, unless the driver moved the map
  useEffect(() => {
    if (!moved.current) showDefaultView();
  }, [topInset, bottomInset]);

  const zoomBy = (levels: number) => {
    if (zoom.current === null) return;
    moved.current = true;
    const target = Math.min(Math.max(zoom.current + levels, limits?.minZoom ?? DRIVER_MAP_MIN_ZOOM), TILESET.maxZoom + MAP_OVERZOOM_LEVELS);
    camera.current?.zoomTo(target, { duration: mapRoute.cameraAnimationMs });
  };

  const onRegionDidChange = (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const view = event.nativeEvent;
    zoom.current = view.zoom;
    const [, centerLat] = view.center;
    // How far the screen reaches above its centre, rounded up so small moves keep the same limit
    const above = Math.ceil((view.bounds[3] - centerLat) / MAP_VIEW_STEP_DEG) * MAP_VIEW_STEP_DEG;
    if (framing.current || defaultZoom.current === null) {
      defaultZoom.current = view.zoom;
      framing.current = false;
      setLimits({ minZoom: view.zoom, northCap: northCenterCap(TILESET.bounds, above, centerLat), keepLat: centerLat });
    } else {
      setLimits((current) => (current ? { ...current, northCap: northCenterCap(TILESET.bounds, above, current.keepLat) } : current));
    }
    setDetail(view.zoom >= defaultZoom.current + DRIVER_MAP_DETAIL_ZOOM);
  };

  const [west, south, east] = TILESET.bounds;
  const maxBounds: Bounds = limits ? [west, south, east, limits.northCap] : TILESET.bounds;

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
    <View style={styles.root}>
      {mapStyle ? (
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
            initialViewState={{ bounds: route.bounds, padding }}
            minZoom={limits?.minZoom ?? DRIVER_MAP_MIN_ZOOM}
            maxZoom={TILESET.maxZoom + MAP_OVERZOOM_LEVELS}
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
            {named ? (
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

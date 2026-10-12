import { Camera, GeoJSONSource, Layer, Map, type StyleSpecification } from '@maplibre/maplibre-react-native';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { prepareOfflineTiles } from '@/data/offline/tiles';
import { buildOfflineStyle } from '@/data/map/offlineStyle';
import type { HeatmapRow } from '@/shared/driver/heatmapView';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

import type { DriverRoute } from './routeStops';

// DR5: the driver's static map (PRD 9.4): the bundled offline tiles, the route framed once, no
// gestures (nothing to touch while driving, PRD 15.3), and a glowing node per stop sized and coloured
// by its band. Unknown stops are small grey dots; a stale heatmap is all grey. If the map cannot
// load, the list below still works alone (plan risk R8).

type TilesState = { status: 'preparing' } | { status: 'ready'; url: string } | { status: 'error' };

// Node sizes by band index (0 to 3), in dp, and the glow around them
const CORE_RADIUS = [5, 8, 11, 14];
const UNKNOWN_RADIUS = 4;
const GLOW_SCALE = 2.2;
const GLOW_OPACITY = 0.45;
const LINE_WIDTH = 4;
const LINE_OPACITY = 0.6;
const FRAME_PADDING = spacing.lg;

function useDriverTiles(): TilesState {
  const [state, setState] = useState<TilesState>({ status: 'preparing' });
  useEffect(() => {
    let cancelled = false;
    prepareOfflineTiles()
      .then((tiles) => {
        if (!cancelled) setState({ status: 'ready', url: tiles.url });
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
};

export function HeatmapMap({ route, rows, stale }: Props) {
  const styles = useStyles();
  const { baseMap, mapPaint, routeColor, typography } = useTheme();
  const tiles = useDriverTiles();

  const mapStyle = useMemo(
    () => (tiles.status === 'ready' ? (buildOfflineStyle(tiles.url, baseMap, null) as unknown as StyleSpecification) : null),
    [tiles, baseMap],
  );

  const nodes = useMemo<FeatureCollection<Point>>(() => {
    const bandColors = [mapPaint.stop, mapPaint.occupancyGreen, mapPaint.occupancyAmber, mapPaint.occupancyRed];
    const byCode = new globalThis.Map(rows.map((row) => [row.code, row.display]));
    return {
      type: 'FeatureCollection',
      features: route.stops.map((stop) => {
        const display = byCode.get(stop.code);
        const known = display?.kind === 'known';
        const band = known ? display.band : 0;
        return {
          type: 'Feature',
          properties: {
            color: stale || !known ? mapPaint.stale : bandColors[band],
            radius: known ? CORE_RADIUS[band] : UNKNOWN_RADIUS,
            // Only a fresh count above zero glows
            glow: known && !stale && band > 0,
          },
          geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] },
        };
      }),
    };
  }, [route, rows, stale, mapPaint]);

  const lines = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: route.lines.map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })),
    }),
    [route],
  );

  if (tiles.status === 'error' || !route.bounds) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={typography.bodyMd}>{strings.driver.heatmap.mapUnavailable}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root} pointerEvents="none">
      {mapStyle ? (
        <Map
          style={styles.fill}
          mapStyle={mapStyle}
          logo={false}
          attribution={false}
          dragPan={false}
          touchZoom={false}
          doubleTapZoom={false}
          doubleTapHoldZoom={false}
          touchRotate={false}
          touchPitch={false}
        >
          <Camera initialViewState={{ bounds: route.bounds, padding: { top: FRAME_PADDING, right: FRAME_PADDING, bottom: FRAME_PADDING, left: FRAME_PADDING } }} />
          <GeoJSONSource id="driver-route" data={lines}>
            <Layer
              id="driver-route-line"
              type="line"
              paint={{ 'line-color': routeColor(route.routeCode, route.color), 'line-width': LINE_WIDTH, 'line-opacity': LINE_OPACITY }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
          <GeoJSONSource id="driver-nodes" data={nodes}>
            <Layer
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
              id="driver-node"
              type="circle"
              paint={{
                'circle-radius': ['get', 'radius'],
                'circle-color': ['get', 'color'],
                'circle-stroke-color': mapPaint.stopStroke,
                'circle-stroke-width': 1,
              }}
            />
          </GeoJSONSource>
        </Map>
      ) : null}
      <Text style={[typography.caption, styles.credit]}>{strings.common.attribution}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    overflow: 'hidden',
    backgroundColor: colors.surface,
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
    left: spacing.sm,
    bottom: spacing.xs,
  },
}));

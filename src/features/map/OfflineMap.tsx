import {
  Camera,
  Map,
  type CameraRef,
  type StyleSpecification,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { Info } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type NativeSyntheticEvent } from 'react-native';

import { GLYPH_FONT_REGULAR, LABEL_PROOF } from '@/data/map/glyphset';
import { buildOfflineStyle } from '@/data/map/offlineStyle';
import { TILESET } from '@/data/map/tileset';
import { MAP_ATTRIBUTION_SHOW_S, MAP_BOUNDS_MARGIN_DEG, MAP_LABEL_PROOF_DEV, MAP_OVERZOOM_LEVELS, MAP_REFIT_WINDOW_MS } from '@/shared/config';
import { padBounds, type Bounds } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { useSettingsStore } from '@/state/settingsStore';
import { strings } from '@/strings';

import { MapLabels } from './MapLabels';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

const PADDING = { top: spacing.xl, right: spacing.xl, bottom: spacing.xl, left: spacing.xl };
// B8: the camera may go a little past the offline tiles, so a route near their edge (De Oro, at the
// north) can still be framed in the space the cards leave; the margin mostly sits under the top bar
const PAN_BOUNDS = padBounds(TILESET.bounds, MAP_BOUNDS_MARGIN_DEG);

export type MapStatus = 'loading' | 'loaded' | 'failed';

// Where to move the camera. A new `key` repeats the move even if the target is unchanged,
// for example when "Show whole route" is tapped twice.
// A centre move may also set the zoom, for example when following the blue dot.
export type MapFocusTarget = { kind: 'bounds'; bounds: Bounds } | { kind: 'center'; center: LatLon; zoom?: number };
export type MapFocus = MapFocusTarget & { key: number };

type OfflineMapProps = {
  // Style source URL of the installed tile file (see prepareOfflineTiles)
  tilesUrl: string;
  // Style glyph template of the installed label fonts (see prepareOfflineTiles); null when missing
  glyphsUrl?: string | null;
  // Area shown when the map first opens
  initialBounds: Bounds;
  // Moves the camera when it changes
  focus?: MapFocus | null;
  onStatusChange?: (status: MapStatus) => void;
  onViewChange?: (view: ViewStateChangeEvent) => void;
  // Called with the tapped position, for picking a point by hand
  onPress?: (position: LatLon) => void;
  // Called with the long-pressed position (the manual origin pin when location is off, PRD 4.2)
  onLongPress?: (position: LatLon) => void;
  // Called when the user starts moving the map by hand (stops following the blue dot)
  onUserMove?: () => void;
  // Height of anything covering the bottom of the map, such as a bottom sheet. Fitted areas keep clear of it.
  bottomInset?: number;
  // B8: the same for the top (the top bar and a route card over the map)
  topInset?: number;
  // LB1b: labels at LABEL_DIMMED_OPACITY while a route is selected
  labelsDimmed?: boolean;
  // Map content drawn on top of the base map: route line, stops, vehicle markers and, later, the blue dot
  children?: ReactNode;
  // The (i) credit sits this far from the top on the left; by default, above the bottom inset
  attributionTop?: number;
};

export function OfflineMap({
  tilesUrl,
  glyphsUrl,
  initialBounds,
  focus,
  onStatusChange,
  onViewChange,
  onPress,
  onLongPress,
  onUserMove,
  bottomInset = 0,
  topInset = 0,
  labelsDimmed = false,
  attributionTop,
  children,
}: OfflineMapProps) {
  const styles = useStyles();
  const { scheme, colors, mapRoute, baseMap } = useTheme();
  const camera = useRef<CameraRef>(null);
  // Labels need the local glyphs; switching them on or off mounts the map afresh, like a theme
  // change, so they always stay under the layers drawn on top
  const labelsOn = useSettingsStore((state) => state.mapLabels);
  const showLabels = labelsOn && !!glyphsUrl;
  // The style object must keep its identity between renders, or the map reloads it.
  // It changes only with the tile file or the theme.
  const mapStyle = useMemo(() => {
    // LB1a: the dev-only test label proves the local glyph files draw
    const proof =
      __DEV__ && MAP_LABEL_PROOF_DEV
        ? { font: GLYPH_FONT_REGULAR, ...LABEL_PROOF, textColor: colors.textPrimary, haloColor: baseMap.land }
        : undefined;
    return buildOfflineStyle(tilesUrl, baseMap, glyphsUrl, proof) as unknown as StyleSpecification;
  }, [tilesUrl, baseMap, glyphsUrl, colors.textPrimary]);

  const padding = { ...PADDING, top: PADDING.top + topInset, bottom: PADDING.bottom + bottomInset };
  // B8: the last area framed and when, to frame it again if the cards over the map change size
  const lastFit = useRef<{ bounds: MapFocusTarget & { kind: 'bounds' }; atMs: number } | null>(null);

  useEffect(() => {
    if (!focus) return;
    const animation = { duration: mapRoute.cameraAnimationMs };
    if (focus.kind === 'bounds') {
      camera.current?.fitBounds(focus.bounds, { padding, ...animation });
      lastFit.current = { bounds: focus, atMs: Date.now() };
    } else {
      lastFit.current = null;
      camera.current?.easeTo({
        center: [focus.center.lon, focus.center.lat],
        ...(focus.zoom !== undefined ? { zoom: focus.zoom } : {}),
        ...animation,
      });
    }
    // Only a new focus moves the camera here; a change of inset is handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, mapRoute.cameraAnimationMs]);

  // B8: a card over the map grew or shrank just after a fit (the bottom card swaps when a route is
  // picked): frame the same area again, so no empty band is left above or below it. Later inset
  // changes leave the camera where the user put it.
  useEffect(() => {
    const fit = lastFit.current;
    if (!fit || Date.now() - fit.atMs > MAP_REFIT_WINDOW_MS) return;
    camera.current?.fitBounds(fit.bounds.bounds, { padding, duration: mapRoute.cameraAnimationMs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomInset, topInset]);

  const handleRegionDidChange = (event: NativeSyntheticEvent<ViewStateChangeEvent>) => onViewChange?.(event.nativeEvent);

  return (
    <View style={styles.root}>
      {/* A new theme loads a new base style, which drops the route layers drawn on top; mounting the
          map afresh for each theme draws everything again in the new colours. */}
      <Map
        key={`${scheme}-${showLabels ? 'labels' : 'plain'}`}
        style={styles.map}
        mapStyle={mapStyle}
        logo={false}
        attribution={false}
        onDidFinishLoadingMap={() => onStatusChange?.('loaded')}
        onDidFailLoadingMap={() => onStatusChange?.('failed')}
        onRegionDidChange={handleRegionDidChange}
        onRegionWillChange={(event) => {
          if (event.nativeEvent.userInteraction) onUserMove?.();
        }}
        onLongPress={
          onLongPress
            ? (event) => {
                const [lon, lat] = event.nativeEvent.lngLat;
                onLongPress({ lat, lon });
              }
            : undefined
        }
        onPress={
          onPress
            ? (event) => {
                const [lon, lat] = event.nativeEvent.lngLat;
                onPress({ lat, lon });
              }
            : undefined
        }
      >
        {/* LB1b: names first, so route lines, stops and vehicles are drawn over them */}
        {showLabels ? <MapLabels dimmed={labelsDimmed} /> : null}
        <Camera
          ref={camera}
          initialViewState={{ bounds: initialBounds, padding }}
          minZoom={TILESET.minZoom}
          maxZoom={TILESET.maxZoom + MAP_OVERZOOM_LEVELS}
          maxBounds={PAN_BOUNDS}
        />
        {children}
      </Map>
      <Attribution position={attributionTop !== undefined ? { top: attributionTop } : { bottom: bottomInset + spacing.sm }} />
    </View>
  );
}

const MS_PER_S = 1000;
const INFO_SIZE = spacing.md;
const ATTRIBUTION_FOLDED_OPACITY = 0.6;

// The OpenStreetMap credit (ODbL): a faint (i) button in the corner, as OSM's attribution guidelines
// allow on small screens. Tapping it shows the credit for MAP_ATTRIBUTION_SHOW_S; the licence
// itself is in About, Licences.
function Attribution({ position }: { position: { top: number } | { bottom: number } }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => setOpen(false), MAP_ATTRIBUTION_SHOW_S * MS_PER_S);
    return () => clearTimeout(timer);
  }, [open]);
  return (
    <Pressable
      style={[styles.attribution, position, !open && styles.attributionFolded]}
      onPress={() => setOpen((value) => !value)}
      accessibilityRole="button"
      accessibilityLabel={strings.common.attribution}
    >
      <Info color={colors.textSecondary} size={INFO_SIZE} />
      {open ? <Text style={typography.caption}>{strings.common.attribution}</Text> : null}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  map: {
    flex: 1,
  },
  attribution: {
    position: 'absolute',
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
  },
  attributionFolded: {
    opacity: ATTRIBUTION_FOLDED_OPACITY,
  },
}));

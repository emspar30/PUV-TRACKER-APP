import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { CircleDot, LocateFixed, Maximize, Navigation, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AvatarButton,
  BottomSheet,
  Chip,
  Logo,
  RoundButton,
  RouteChip,
  StatusPill,
  type SheetRequest,
} from '@/components';
import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { GreetingCard } from '@/features/greeting/GreetingCard';
import { BlueDot } from '@/features/map/BlueDot';
import { LocationExplainer } from '@/features/map/LocationExplainer';
import { MapDevOverlay } from '@/features/map/MapDevOverlay';
import { OfflineMap, type MapFocus, type MapStatus } from '@/features/map/OfflineMap';
import { OriginPin } from '@/features/map/OriginPin';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useLiveLocation } from '@/features/map/useLiveLocation';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { useRouteLayers } from '@/features/map/useRouteLayers';
import { MAP_FOLLOW_ZOOM } from '@/shared/config';
import { boundsOfLines, clipBounds } from '@/shared/geo/bounds';
import { lineLengthKm, projectOntoLine } from '@/shared/geo/line';
import type { DirectedLine, RouteDirection, RouteStop } from '@/shared/routing/types';
import { routeCodesOf, toggleRoute } from '@/shared/ui/routeVisibility';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const DIRECTIONS: readonly RouteDirection[] = ['outbound', 'return'];
const LOGO_SIZE = spacing.xl * 3;
const ICON_SIZE = spacing.md + spacing.xs;
const SWATCH_WIDTH = spacing.lg;
// Room under the status bar for the map credit, above the DEV line
const CREDIT_HEIGHT = spacing.lg;

type LineSummary = { line: DirectedLine; from: string; to: string; lengthKm: number };

// First and last stop along a line, in its direction of travel, and its length
function summarise(line: DirectedLine, stops: RouteStop[]): LineSummary {
  const ordered = [...stops].sort(
    (a, b) => projectOntoLine(line.coordinates, a).chainageKm - projectOntoLine(line.coordinates, b).chainageKm,
  );
  return {
    line,
    from: ordered[0]?.code ?? '',
    to: ordered[ordered.length - 1]?.code ?? '',
    lengthKm: lineLengthKm(line.coordinates),
  };
}

// Live tab: a full-screen map of the route under a draggable sheet. Vehicles arrive in S5;
// until then the status is "No data", never "no vehicles".
export default function LiveScreen() {
  const styles = useStyles();
  const { colors, typography, mapRoute, routeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, retry } = useOfflineTiles();
  const { lines, stops, isPlaceholder } = useRouteData();

  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [view, setView] = useState<ViewStateChangeEvent | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [sheetRequest, setSheetRequest] = useState<SheetRequest | null>(null);
  // Tunton's greeting shows on every app open until hidden
  const [greetingVisible, setGreetingVisible] = useState(true);
  const fittedOnce = useRef(false);

  const location = useLiveLocation((center) =>
    setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center, zoom: MAP_FOLLOW_ZOOM })),
  );

  // UX3: the map is clean until a route is picked. Kept while the app is open, not saved.
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [directions, setDirections] = useState<Record<RouteDirection, boolean>>(ALL_DIRECTIONS);
  const layers = useRouteLayers(lines, stops, 'live', selectedRoute);
  const routeStops = layers.stops;
  const routeCodes = useMemo(() => routeCodesOf(lines), [lines]);
  const routeLines = useMemo(() => lines.filter((line) => line.routeCode === selectedRoute), [lines, selectedRoute]);

  // The routes' box, clipped to the tile set so the opening view always has map data (RR1)
  const initialBounds = useMemo(() => clipBounds(boundsOfLines(lines.map((line) => line.coordinates)), TILESET.bounds), [lines]);
  const routeBounds = useMemo(
    () => (routeLines.length > 0 ? clipBounds(boundsOfLines(routeLines.map((line) => line.coordinates)), TILESET.bounds) : initialBounds),
    [routeLines, initialBounds],
  );
  const summaries = useMemo(() => routeLines.map((line) => summarise(line, routeStops)), [routeLines, routeStops]);
  const outbound = routeLines.find((line) => line.direction === 'outbound');
  const colorOfRoute = (code: string) => {
    const line = lines.find((candidate) => candidate.routeCode === code);
    return line ? routeColor(code, line.color) : colors.primary;
  };

  const pickRoute = (code: string) => {
    const next = toggleRoute(selectedRoute, code);
    setSelectedRoute(next);
    setSelectedCode(null);
    if (next) {
      const ofRoute = lines.filter((line) => line.routeCode === next);
      // The sheet keeps its height, so the route is framed above it as it is now
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds: boundsOfLines(ofRoute.map((line) => line.coordinates)) }));
    }
  };

  // At least one direction stays on, so a selected route never disappears by accident
  const toggleDirection = (direction: RouteDirection) =>
    setDirections((current) => {
      const next = { ...current, [direction]: !current[direction] };
      return next.outbound || next.return ? next : current;
    });

  const alongKm = useCallback(
    (stop: RouteStop) => (outbound ? projectOntoLine(outbound.coordinates, stop).chainageKm : null),
    [outbound],
  );
  const selected = stops.find((stop) => stop.code === selectedCode) ?? null;

  const showWholeRoute = useCallback(() => {
    setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds: routeBounds }));
  }, [routeBounds]);

  const handleSnapChange = useCallback(
    (_snap: unknown, visibleHeight: number) => {
      setSheetHeight(visibleHeight);
      // Once the sheet's size is known, frame the route above it
      if (!fittedOnce.current) {
        fittedOnce.current = true;
        setFocus({ key: 1, kind: 'bounds', bounds: initialBounds });
      }
    },
    [initialBounds],
  );

  const selectStop = useCallback(
    (code: string | null) => {
      setSelectedCode(code);
      const stop = stops.find((candidate) => candidate.code === code);
      if (stop) {
        setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: stop }));
        setSheetRequest((current) => ({ key: (current?.key ?? 0) + 1, snap: 'half' }));
      }
    },
    [stops],
  );

  const handleStatusChange = useCallback((status: MapStatus) => {
    if (__DEV__) console.log(`[map] status: ${status}`);
    setMapStatus(status);
  }, []);

  const handleViewChange = useCallback((next: ViewStateChangeEvent) => {
    if (__DEV__) {
      console.log(`[map] view: zoom ${next.zoom.toFixed(2)} centre ${next.center[0]}, ${next.center[1]}`);
      setView(next);
    }
  }, []);

  if (state.status === 'preparing') {
    return (
      <View style={styles.centered}>
        <Logo size={LOGO_SIZE} />
        <Text style={typography.bodyLg}>{strings.loading.tiles}</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    if (__DEV__) console.log(`[map] tiles error: ${state.message}`);
    return (
      <View style={styles.centered}>
        <Text style={typography.bodyLg}>{strings.loading.tilesFailed}</Text>
        <Text style={[typography.bodySm, styles.center]}>{state.message}</Text>
        <Pressable style={styles.button} onPress={retry} accessibilityRole="button">
          <Text style={typography.labelLg}>{strings.common.tryAgain}</Text>
        </Pressable>
      </View>
    );
  }

  const header = (
    <View style={styles.peek}>
      {routeCodes.map((code) => (
        <RouteChip
          key={code}
          code={code}
          color={colorOfRoute(code)}
          selected={code === selectedRoute}
          onPress={() => pickRoute(code)}
          accessibilityLabel={strings.live.routeChip(code, code === selectedRoute)}
        />
      ))}
      {/* Three route chips fill the peek row; the route's ends are shown in the sheet */}
      <View style={styles.grow} />
      {isPlaceholder ? <Chip label={strings.common.sampleData} /> : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <OfflineMap
        tilesUrl={state.tiles.url}
        initialBounds={initialBounds}
        focus={focus}
        bottomInset={sheetHeight}
        attributionTop={insets.top + spacing.sm}
        onStatusChange={handleStatusChange}
        onViewChange={handleViewChange}
        onLongPress={location.setManualOrigin}
        onUserMove={location.stopFollowing}
      >
        <RouteLines lines={layers.lines} visible={directions} opacity={layers.opacity} />
        <StopDots stops={routeStops} selectedCode={selectedCode} onPressStop={selectStop} />
        {!location.locationAllowed ? <OriginPin /> : null}
        <BlueDot />
      </OfflineMap>
      <MapDevOverlay install={state.tiles.install} mapStatus={mapStatus} view={view} offsetTop={CREDIT_HEIGHT + spacing.sm} />
      <View style={[styles.topRight, { top: insets.top + spacing.sm }]}>
        <AvatarButton />
      </View>

      <BottomSheet
        id="live"
        defaultSnap="peek"
        request={sheetRequest}
        onSnapChange={handleSnapChange}
        header={header}
        floating={
          <View style={styles.floating}>
            {location.showExplainer ? (
              <LocationExplainer onContinue={location.continueExplainer} onNotNow={location.dismissExplainer} />
            ) : greetingVisible && !selectedRoute ? (
              <GreetingCard onHide={() => setGreetingVisible(false)} />
            ) : null}
            {location.reducedMode ? (
              <View style={styles.notice}>
                <Text style={[typography.bodySm, styles.grow]}>{strings.location.off}</Text>
                <Pressable style={styles.noticeButton} onPress={location.locateMe} accessibilityRole="button">
                  <Text style={[typography.labelLg, styles.noticeAction]}>
                    {location.canAskAgain ? strings.location.turnOn : strings.location.openSettings}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {location.fix && !location.fixOnMap ? (
              <View style={styles.notice}>
                <Text style={[typography.bodySm, styles.grow]}>{strings.location.outsideMap}</Text>
              </View>
            ) : null}
            <View style={styles.floatingRow}>
              <StatusPill label={selectedRoute ? strings.live.status.noData : strings.live.pickRoute} tone="neutral" />
              <View style={styles.buttons}>
                <RoundButton
                  icon={LocateFixed}
                  label={location.following ? strings.location.following : strings.location.locateMe}
                  onPress={location.locateMe}
                  active={location.following && location.locationAllowed}
                />
                {layers.view.showRouteControls ? (
                  <RoundButton icon={Maximize} label={strings.map.showWholeRoute} onPress={showWholeRoute} />
                ) : null}
              </View>
            </View>
          </View>
        }
      >
        {selected ? (
          <View style={styles.stopCard}>
            <View style={styles.grow}>
              <Text style={typography.headlineSm}>{selected.code}</Text>
              <Text style={typography.bodyMd} numberOfLines={2}>
                {selected.name}
              </Text>
              {alongKm(selected) !== null ? (
                <Text style={typography.bodySm}>{strings.live.stopAlong(alongKm(selected) ?? 0)}</Text>
              ) : null}
            </View>
            <Pressable
              style={styles.iconButton}
              onPress={() => setSelectedCode(null)}
              accessibilityRole="button"
              accessibilityLabel={strings.live.closeStop}
            >
              <X color={colors.textSecondary} size={ICON_SIZE} />
            </Pressable>
          </View>
        ) : null}

        {!selectedRoute ? (
          <Text style={typography.bodyMd}>{strings.live.pickRoute}</Text>
        ) : (
          <>
        <View style={styles.chipsRow}>
          {DIRECTIONS.filter((direction) => routeLines.some((line) => line.direction === direction)).map((direction) => (
            <Chip
              key={direction}
              label={direction === 'outbound' ? strings.direction.outbound : strings.direction.return}
              selected={directions[direction]}
              onPress={() => toggleDirection(direction)}
            />
          ))}
        </View>

        <Text style={typography.bodyMd}>{strings.live.noData}</Text>

        <View style={styles.group}>
          {summaries.map(({ line, from, to, lengthKm }) => (
            <View key={line.id} style={styles.row}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: routeColor(line.routeCode, line.color) },
                  line.direction === 'return' && styles.swatchReturn,
                ]}
              />
              <Text style={[typography.labelLg, styles.grow]}>
                {line.direction === 'outbound' ? strings.direction.outbound : strings.direction.return}
                {'  '}
                <Text style={typography.bodyMd}>{from && to ? strings.live.ends(from, to) : ''}</Text>
              </Text>
              <Text style={typography.bodySm}>{strings.live.length(lengthKm)}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <View style={styles.swatchSlot}>
              <View style={[styles.legendDot, { borderColor: mapRoute.stopStrokeColor }]} />
            </View>
            <Text style={[typography.bodySm, styles.grow]}>{strings.live.legendStop}</Text>
            <Navigation color={colors.textSecondary} size={ICON_SIZE} />
            <Text style={typography.bodySm}>{strings.live.legendDirection}</Text>
          </View>
        </View>

        <Text style={typography.labelLg}>{strings.live.stopsTitle}</Text>
        <View style={styles.group}>
          {routeStops.map((stop) => {
            const km = alongKm(stop);
            return (
              <Pressable
                key={stop.code}
                style={[styles.stopRow, stop.code === selectedCode && styles.stopRowSelected]}
                onPress={() => selectStop(stop.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: stop.code === selectedCode }}
                accessibilityLabel={`${strings.map.stop(stop.code)}, ${stop.name}`}
              >
                <CircleDot color={colors.textSecondary} size={ICON_SIZE} />
                <View style={styles.grow}>
                  <Text style={typography.labelLg}>{stop.code}</Text>
                  <Text style={typography.bodySm} numberOfLines={2}>
                    {stop.name}
                  </Text>
                </View>
                {km !== null ? <Text style={typography.bodySm}>{strings.live.stopAlong(km)}</Text> : null}
              </Pressable>
            );
          })}
        </View>
          </>
        )}
      </BottomSheet>
    </View>
  );
}

const useStyles = makeStyles(({ colors, mapRoute }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.canvas,
  },
  center: {
    textAlign: 'center',
  },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  floating: {
    flex: 1,
    gap: spacing.sm,
  },
  floatingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  buttons: {
    gap: spacing.sm,
  },
  notice: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.sheet,
  },
  noticeButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeAction: {
    color: colors.primary,
  },
  topRight: {
    position: 'absolute',
    right: spacing.md,
  },
  peek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  group: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: SWATCH_WIDTH,
    height: spacing.xs,
    borderRadius: spacing.xs,
  },
  swatchReturn: {
    height: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: mapRoute.returnDashColor,
  },
  swatchSlot: {
    width: SWATCH_WIDTH,
    alignItems: 'center',
  },
  legendDot: {
    width: spacing.sm + spacing.xs,
    height: spacing.sm + spacing.xs,
    borderRadius: spacing.sm,
    borderWidth: 2,
    backgroundColor: mapRoute.stopColor,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: mapRoute.stopSelectedColor,
    backgroundColor: colors.surfaceLow,
  },
  iconButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopRow: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stopRowSelected: {
    backgroundColor: colors.primaryContainer,
  },
}));

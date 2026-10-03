import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { CircleDot, Maximize, Navigation, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AvatarButton,
  BottomSheet,
  Chip,
  LineBadge,
  Logo,
  RoundButton,
  StatusPill,
  type SheetRequest,
} from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { MapDevOverlay } from '@/features/map/MapDevOverlay';
import { OfflineMap, type MapFocus, type MapStatus } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { boundsOfLines } from '@/shared/geo/bounds';
import { lineLengthKm, projectOntoLine } from '@/shared/geo/line';
import type { DirectedLine, RouteDirection, RouteStop } from '@/shared/routing/types';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
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
  const fittedOnce = useRef(false);

  const initialBounds = useMemo(() => boundsOfLines(lines.map((line) => line.coordinates)), [lines]);
  const summaries = useMemo(() => lines.map((line) => summarise(line, stops)), [lines, stops]);
  const outbound = lines.find((line) => line.direction === 'outbound');
  const routeCode = lines[0]?.routeCode ?? '';
  const badgeColor = lines[0] ? routeColor(lines[0].routeCode, lines[0].color) : colors.primary;

  const alongKm = useCallback(
    (stop: RouteStop) => (outbound ? projectOntoLine(outbound.coordinates, stop).chainageKm : null),
    [outbound],
  );
  const selected = stops.find((stop) => stop.code === selectedCode) ?? null;

  const showWholeRoute = useCallback(() => {
    setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds: initialBounds }));
  }, [initialBounds]);

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
      <LineBadge code={routeCode} color={badgeColor} />
      <Text style={[typography.headlineSm, styles.grow]} numberOfLines={1}>
        {summaries[0] ? strings.live.ends(summaries[0].from, summaries[0].to) : strings.live.route(routeCode)}
      </Text>
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
      >
        <RouteLines lines={lines} visible={ALL_DIRECTIONS} />
        <StopDots stops={stops} selectedCode={selectedCode} onPressStop={selectStop} />
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
          <>
            <StatusPill label={strings.live.status.noData} tone="neutral" />
            <RoundButton icon={Maximize} label={strings.map.showWholeRoute} onPress={showWholeRoute} />
          </>
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
                <Text style={typography.bodyMd}>{strings.live.ends(from, to)}</Text>
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
          {stops.map((stop) => {
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
  stopRowSelected: {
    backgroundColor: colors.primaryContainer,
  },
}));

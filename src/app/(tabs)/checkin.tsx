import { MapPin } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarButton, BottomSheet, Chip, LineBadge, Logo, StatusPill, type SheetRequest } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { OfflineMap, type MapFocus } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { formatCountdown, isActive, remainingMs } from '@/shared/checkin/localCheckin';
import { boundsOfLines } from '@/shared/geo/bounds';
import type { RouteDirection } from '@/shared/routing/types';
import { verifyCheckIn } from '@/shared/verification/verifyCheckIn';
import { useCheckInStore } from '@/state/checkinStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const LOGO_SIZE = spacing.xl * 3;
const ICON_SIZE = spacing.md + spacing.xs;
const TICK_MS = 1000;

// Check-in: pick a route and a station, then one "Check in" button. The check-in lasts 15 minutes
// and is kept on this phone only (UX2). The geofence, the cloud table and the reminder come in G1.
export default function CheckInScreen() {
  const styles = useStyles();
  const { colors, typography, routeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { lines, stops } = useRouteData();
  const { state: tiles } = useOfflineTiles();
  const checkIn = useCheckInStore((state) => state.checkIn);
  const checkInAt = useCheckInStore((state) => state.checkInAt);
  const clear = useCheckInStore((state) => state.clear);

  const routeCodes = useMemo(() => [...new Set(lines.map((line) => line.routeCode))], [lines]);
  const [routeCode, setRouteCode] = useState(routeCodes[0] ?? '');
  const [stationCode, setStationCode] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [sheetRequest, setSheetRequest] = useState<SheetRequest | null>(null);

  const active = isActive(checkIn, now);
  const initialBounds = useMemo(() => boundsOfLines(lines.map((line) => line.coordinates)), [lines]);
  const badgeColor = (code: string) => routeColor(code, lines.find((line) => line.routeCode === code)?.color ?? colors.primary);

  // Tick once a second while a check-in is running; the time left is always worked out from the
  // stored expiry, so a restart or a long time away gives the right answer
  useEffect(() => {
    if (!checkIn) return undefined;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [checkIn]);

  const pickStation = (code: string) => {
    setStationCode(code);
    const stop = stops.find((candidate) => candidate.code === code);
    if (stop) setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: stop }));
  };

  const doCheckIn = () => {
    if (!stationCode || active) return;
    const at = Date.now();
    setNow(at);
    checkInAt(routeCode, stationCode, at);
    setSheetRequest((current) => ({ key: (current?.key ?? 0) + 1, snap: 'half' }));
  };

  // While verification is off this always answers "unverified"; the pill says so
  const verification = active ? verifyCheckIn({ routeCode: checkIn.routeCode, stationCode: checkIn.stationCode }) : null;
  const countdown = active ? formatCountdown(remainingMs(checkIn, now)) : '';

  const header = active ? (
    <View style={styles.peek} accessible accessibilityLabel={strings.checkin.countdownLabel(checkIn.stationCode, countdown)}>
      <LineBadge code={checkIn.routeCode} color={badgeColor(checkIn.routeCode)} />
      <Text style={[typography.headlineSm, styles.grow]}>{checkIn.stationCode}</Text>
      <Text style={[typography.headlineSm, styles.time]}>{countdown}</Text>
    </View>
  ) : (
    <View style={styles.peek}>
      <MapPin color={colors.textSecondary} size={ICON_SIZE} />
      <Text style={[stationCode ? typography.headlineSm : typography.bodyMd, styles.grow]} numberOfLines={1}>
        {stationCode ?? strings.checkin.pickStation}
      </Text>
      <Pressable
        style={[styles.primary, !stationCode && styles.primaryDisabled]}
        onPress={doCheckIn}
        disabled={!stationCode}
        accessibilityRole="button"
        accessibilityState={{ disabled: !stationCode }}
        accessibilityLabel={stationCode ? strings.checkin.checkInAt(stationCode) : strings.checkin.pickStationFirst}
      >
        <Text style={[typography.labelLg, styles.primaryText]}>{strings.checkin.checkIn}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.root}>
      {tiles.status === 'ready' ? (
        <OfflineMap
          tilesUrl={tiles.tiles.url}
          initialBounds={initialBounds}
          focus={focus}
          bottomInset={sheetHeight}
          attributionTop={insets.top + spacing.sm}
        >
          <RouteLines lines={lines} visible={ALL_DIRECTIONS} />
          <StopDots stops={stops} selectedCode={active ? checkIn.stationCode : stationCode} onPressStop={pickStation} />
        </OfflineMap>
      ) : (
        <View style={styles.centered}>
          <Logo size={LOGO_SIZE} />
        </View>
      )}
      <View style={[styles.topRight, { top: insets.top + spacing.sm }]}>
        <AvatarButton />
      </View>

      <BottomSheet
        id="checkin"
        defaultSnap="half"
        request={sheetRequest}
        onSnapChange={(_snap, visibleHeight) => setSheetHeight(visibleHeight)}
        header={header}
      >
        {active ? (
          <View style={styles.card}>
            <View style={styles.pills}>
              <StatusPill label={verification?.status === 'verified' ? strings.checkin.checkIn : strings.checkin.notVerified} tone="warning" />
              <StatusPill label={strings.checkin.phoneOnly} tone="neutral" />
            </View>
            <View style={styles.row}>
              <LineBadge code={checkIn.routeCode} color={badgeColor(checkIn.routeCode)} />
              <Text style={typography.headlineMd}>{checkIn.stationCode}</Text>
            </View>
            <Text style={[typography.display, styles.time]}>{countdown}</Text>
            <View style={styles.row}>
              <Pressable style={styles.primary} onPress={clear} accessibilityRole="button">
                <Text style={[typography.labelLg, styles.primaryText]}>{strings.checkin.boarded}</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={clear} accessibilityRole="button">
                <Text style={typography.labelLg}>{strings.checkin.cancel}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={typography.labelLg}>{strings.checkin.route}</Text>
        <View style={styles.chips}>
          {routeCodes.map((code) => (
            <Chip key={code} label={code} selected={code === routeCode} onPress={active ? undefined : () => setRouteCode(code)} />
          ))}
        </View>

        <Text style={typography.labelLg}>{strings.checkin.stations}</Text>
        <View style={styles.chips}>
          {stops.map((stop) => (
            <Chip
              key={stop.code}
              label={stop.code}
              accessibilityLabel={`${stop.code}, ${stop.name}`}
              selected={stop.code === (active ? checkIn.stationCode : stationCode)}
              onPress={active ? undefined : () => pickStation(stop.code)}
            />
          ))}
        </View>

        <Text style={typography.labelLg}>{strings.checkin.waiting}</Text>
        <View style={styles.row}>
          <StatusPill label={strings.live.status.noData} tone="neutral" />
          <Text style={typography.bodySm}>{strings.checkin.waitingLater}</Text>
        </View>
      </BottomSheet>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  time: {
    fontVariant: ['tabular-nums'],
  },
  primary: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  primaryDisabled: {
    opacity: 0.38,
  },
  primaryText: {
    color: colors.onPrimary,
  },
  secondary: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  card: {
    gap: spacing.sm + spacing.xs,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLow,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
}));

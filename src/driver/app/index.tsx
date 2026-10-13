import { Redirect, router } from 'expo-router';
import { MessageSquareOff, Smartphone, TriangleAlert } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LineBadge } from '@/components/Pills';
import { driftStatus } from '@/shared/driver/drift';
import { busiestStop, heatmapView } from '@/shared/driver/heatmapView';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

import { Notice } from '../components/Notice';
import { beaconOptions, useBeaconStatus } from '../features/beacon/beacon';
import { describeClock, describeUpdate } from '../features/heatmap/describe';
import { BusiestStop } from '../features/heatmap/BusiestStop';
import { HeatmapLegend } from '../features/heatmap/HeatmapLegend';
import { HeatmapList } from '../features/heatmap/HeatmapList';
import { HeatmapMap } from '../features/heatmap/HeatmapMap';
import { driverRoute } from '../features/heatmap/routeStops';
import { useHeatmapInbox } from '../features/heatmap/useHeatmapInbox';
import { StatusStrip } from '../features/status/StatusStrip';
import { useDriverStore } from '../state/driverStore';
import { useHeatmapStore } from '../state/heatmapStore';
import { isBeaconAvailable, isProvisioned, startAdvertising } from '../../../modules/tunton-beacon';
import { canReceiveSms, isSmsAvailable } from '../../../modules/tunton-sms';

// The driver's home (DR4, DR5). Glanceable, nothing to tap (PRD 9.4, 15.3): the status strip (hold
// it for admin), the multicab, the static map of the route with a glowing node per stop (top half)
// and the stops in riding order with their counts (bottom half). The heatmap greys when no valid
// message came for SMS_STALE_HEATMAP_MIN, and says how old it is.
// Look: the Stitch designs (docs/DRIVER_UI_PRD.md 3.1 to 3.5, 2026-10-12) in the commuter app's style:
// white outlined cards, the route badge, status pills. The map stays fixed; only the list scrolls. A
// stale heatmap gets a red notice over the list (3.2); at night the heading says only ranges are shown
// (3.4); a problem the driver cannot fix is an amber notice with "Ask an admin." (3.5).
// Owner's request 2026-10-14: the map fills the screen; the strip, the multicab and any warning float
// over its top, the colour key and the list of stops (a panel of cards) over its bottom, and the
// route is framed in the space between them.

// The list panel takes this share of the screen's height; the map shows between the panels
const LIST_SHARE = 0.38;

// The age and the stale state change by the minute
const TICK_MS = 30_000;

function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function DriverHome() {
  const setup = useDriverStore((state) => state.setup);
  const beaconEnabled = useDriverStore((state) => state.beaconEnabled);
  const heatmap = useHeatmapStore((state) => state.heatmap);
  const driftSamples = useHeatmapStore((state) => state.driftSamples);
  const status = useBeaconStatus();
  const now = useNow();
  const styles = useStyles();
  const { height: windowHeight } = useWindowDimensions();
  // Where the floating panels end and start, measured, so the map frames the route between them
  const [screenHeight, setScreenHeight] = useState<number | null>(null);
  const [topEnd, setTopEnd] = useState<number | null>(null);
  const [bottomStart, setBottomStart] = useState<number | null>(null);
  const { colors, typography, routeColor } = useTheme();
  // The setup is saved but the phone lost its secrets (a restored backup, a reset lock screen)
  const lostSecrets = setup !== null && isBeaconAvailable() && !isProvisioned();
  const smsOff = setup !== null && isSmsAvailable() && !canReceiveSms();

  useHeatmapInbox(setup !== null && !lostSecrets);

  // The beacon should be on but its service is not running: the system killed the app (a force
  // stop, or a swipe from the recent apps on some phones, DR5). Start it again; a second start
  // while one is under way is ignored by the service.
  const serviceDown = !status.enabled || !status.running;
  useEffect(() => {
    if (setup && beaconEnabled && !lostSecrets && isBeaconAvailable() && serviceDown) {
      startAdvertising(beaconOptions()).catch(() => {
        // Shown through the status strip
      });
    }
  }, [setup, beaconEnabled, lostSecrets, serviceDown]);

  const route = useMemo(() => (setup ? driverRoute(setup.routeCode) : null), [setup]);
  const forRoute = heatmap && setup && heatmap.route === setup.routeCode ? heatmap : null;
  const view = useMemo(() => heatmapView(forRoute, route?.stops ?? [], now), [forRoute, route, now]);

  if (!setup || !route) return <Redirect href="/provision" />;

  const update = describeUpdate(view);
  const stale = view.freshness === 'stale';
  const text = strings.driver.heatmap;

  const busiest = busiestStop(view.rows);
  const measured = screenHeight !== null && topEnd !== null && bottomStart !== null;

  return (
    <View style={styles.root} onLayout={(event: LayoutChangeEvent) => setScreenHeight(event.nativeEvent.layout.height)}>
      {measured ? <HeatmapMap route={route} rows={view.rows} stale={stale} topInset={topEnd} bottomInset={screenHeight - bottomStart} /> : null}
      <SafeAreaView style={styles.overlay} edges={['top', 'left', 'right', 'bottom']} pointerEvents="box-none">
        <View
          style={styles.group}
          pointerEvents="box-none"
          onLayout={({ nativeEvent: { layout } }: LayoutChangeEvent) => setTopEnd(layout.y + layout.height)}
        >
          <StatusStrip status={status} update={update} clock={describeClock(driftStatus(driftSamples))} onAdminHold={() => router.push('/admin')} />
          <View style={[styles.card, styles.floating, styles.vehicle]}>
            <View style={styles.plate}>
              <Text style={[typography.labelSm, styles.caps]}>{strings.driver.vehiclePlate}</Text>
              <Text style={[typography.headlineLg, styles.plateText]} numberOfLines={1} adjustsFontSizeToFit>
                {setup.plate}
              </Text>
            </View>
            {/* Owner, 2026-10-14: the route badge, and the route's ends (or its loop) under it */}
            <View style={styles.routeText}>
              <LineBadge code={setup.routeCode} color={routeColor(setup.routeCode, route.color)} />
              {route.name ? (
                <Text style={[typography.bodyMd, styles.routeName]} numberOfLines={2}>
                  {route.name}
                </Text>
              ) : null}
            </View>
          </View>
          {lostSecrets ? <Notice tone="warning" icon={Smartphone} title={strings.driver.resetNeeded} body={strings.driver.askAdmin} strongBody /> : null}
          {smsOff ? <Notice tone="warning" icon={MessageSquareOff} title={strings.driver.smsMissing} body={strings.driver.askAdmin} strongBody /> : null}
        </View>
        {/* The map shows through here, and takes the driver's drags and pinches */}
        <View style={styles.grow} pointerEvents="none" />
        <View
          style={styles.group}
          pointerEvents="box-none"
          onLayout={({ nativeEvent: { layout } }: LayoutChangeEvent) => setBottomStart(layout.y)}
        >
          <HeatmapLegend />
          <View style={[styles.panel, styles.floating, { height: windowHeight * LIST_SHARE }]}>
            {stale ? <Notice tone="danger" icon={TriangleAlert} title={update.label} body={text.staleBody} /> : null}
            <View style={styles.listHeader}>
              <View style={styles.heading}>
                <Text style={typography.headlineSm}>{text.title}</Text>
                {view.bandsOnly ? <Text style={[typography.bodyMd, { color: colors.textSecondary }]}>{text.bandsOnly}</Text> : null}
              </View>
              {/* When stale, the notice above already says how old the counts are */}
              {stale ? null : <Text style={[typography.headlineSm, { color: update.tone === 'warn' ? colors.warning : colors.textSecondary }]}>{update.label}</Text>}
            </View>
            {busiest && !stale ? <BusiestStop stop={busiest} /> : null}
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              <HeatmapList rows={view.rows} stale={stale} />
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const PLATE_LETTER_SPACING = 0.5;

const useStyles = makeStyles(({ colors, elevation }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    padding: spacing.md,
  },
  group: {
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  // A panel over the map: the commuter app's floating bars have the same shadow
  floating: {
    ...elevation.level2,
  },
  // The list: a light grey panel, so its white stop cards stand out
  panel: {
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    paddingBottom: 0,
    borderRadius: radii.card,
    backgroundColor: colors.canvas,
  },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  vehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  plate: {
    flex: 1,
  },
  caps: {
    textTransform: 'uppercase',
  },
  plateText: {
    fontWeight: '700',
    letterSpacing: PLATE_LETTER_SPACING,
  },
  routeText: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    maxWidth: '45%',
  },
  routeName: {
    textAlign: 'right',
  },
  listHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heading: {
    flexShrink: 1,
  },
  list: {
    paddingBottom: spacing.md,
  },
}));

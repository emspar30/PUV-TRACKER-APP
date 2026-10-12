import { Redirect, router } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LineBadge } from '@/components/Pills';
import { driftStatus } from '@/shared/driver/drift';
import { heatmapView } from '@/shared/driver/heatmapView';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

import { beaconOptions, useBeaconStatus } from '../features/beacon/beacon';
import { describeClock, describeUpdate } from '../features/heatmap/describe';
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
// Look: the Stitch design (docs/DRIVER_UI_PRD.md 3.1, 2026-10-12) in the commuter app's style: white
// outlined cards, the route badge, status pills. The map stays fixed; only the list scrolls.

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

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <StatusStrip status={status} update={update} clock={describeClock(driftStatus(driftSamples))} onAdminHold={() => router.push('/admin')} />
      <View style={[styles.card, styles.vehicle]}>
        <View style={styles.plate}>
          <Text style={[typography.labelSm, styles.caps]}>{strings.driver.vehiclePlate}</Text>
          <Text style={[typography.headlineLg, styles.plateText]} numberOfLines={1} adjustsFontSizeToFit>
            {setup.plate}
          </Text>
        </View>
        <LineBadge code={setup.routeCode} color={routeColor(setup.routeCode, route.color)} />
        <View style={styles.routeText}>
          <Text style={typography.headlineSm}>{strings.driver.route(setup.routeCode)}</Text>
          {route.name ? (
            <Text style={typography.bodySm} numberOfLines={1}>
              {route.name}
            </Text>
          ) : null}
        </View>
      </View>
      {lostSecrets ? <Warning text={strings.driver.resetNeeded} /> : null}
      {smsOff ? <Warning text={strings.driver.smsMissing} /> : null}
      <View style={styles.half}>
        <HeatmapMap route={route} rows={view.rows} stale={stale || view.freshness === 'never'} />
      </View>
      <View style={styles.half}>
        <View style={styles.listHeader}>
          <Text style={typography.headlineSm}>{text.title}</Text>
          <Text style={[typography.headlineSm, { color: update.tone === 'bad' ? colors.danger : colors.textSecondary }]}>{update.label}</Text>
        </View>
        {stale ? <Text style={[typography.bodyLg, { color: colors.danger }]}>{text.staleBody}</Text> : null}
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <HeatmapList rows={view.rows} stale={stale} bandsOnly={view.bandsOnly} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Information only: the driver has nothing to do here but tell an admin
function Warning({ text }: { text: string }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.card, styles.warning]}>
      <TriangleAlert color={colors.warning} size={WARNING_ICON} />
      <Text style={[typography.headlineSm, styles.warningText]}>{text}</Text>
    </View>
  );
}

const WARNING_ICON = 24;
const PLATE_LETTER_SPACING = 0.5;

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
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
    maxWidth: '40%',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.warningContainer,
    backgroundColor: colors.warningContainer,
  },
  warningText: {
    flex: 1,
  },
  half: {
    flex: 1,
    gap: spacing.xs,
  },
  listHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  list: {
    paddingBottom: spacing.md,
  },
}));

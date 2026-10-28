import { Armchair, BellRing, Bus, Square } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Button, IconTile, StatusPill, type IconTone } from '@/components';
import { ETA_MAX_KM, VEHICLE_CAPACITY_SEATS } from '@/shared/config';
import { etaDistanceKm, type Eta, type TrackProgress } from '@/shared/tracking/eta';
import { ageSeconds } from '@/shared/telemetry/coverage';
import { seatTier, type SeatTier } from '@/shared/telemetry/occupancy';
import type { VehicleSnapshot } from '@/shared/telemetry/vehicle';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

type TrackingPanelProps = {
  // null when the tracked vehicle has no recent position
  vehicle: VehicleSnapshot | null;
  nowMs: number;
  eta: Eta | null;
  progress: TrackProgress;
  // What the ETA is to: the commuter's boarding point, or (without one) the vehicle's next stop
  etaTarget?: 'mine' | 'next';
  // The vehicle has gone past the commuter; the ETA and distance are to its next time round
  passedMe?: boolean;
  alertOn: boolean;
  // Shown once the alert has fired
  alertMessage: string | null;
  onToggleAlert: () => void;
  onStop: () => void;
};

const STOP_BUTTON = MIN_TOUCH_TARGET + spacing.xs;
const SEGMENT_HEIGHT = spacing.xs;
const ICON_SIZE = spacing.md + spacing.xs;
// EQ-5: the seats tile in the vehicle's seat-tier colour, as on the vehicle card and the map halo
const TIER_TONE: Record<SeatTier, IconTone> = { green: 'success', amber: 'warning', red: 'danger' };

// Tracking one multicab (L2, PRD 19.2 D9): the ETA to the commuter's stop, where the vehicle is among
// the stops, the vehicle and its seats, an in-app arrival alert (blue when on), and Stop (red).
// One update time only: the Last updated box.
export function TrackingPanel({ vehicle, nowMs, eta, progress, etaTarget = 'mine', passedMe = false, alertOn, alertMessage, onToggleAlert, onStop }: TrackingPanelProps) {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  const t = strings.live.tracking;
  const age = vehicle ? strings.live.vehicle.ageSeconds(ageSeconds(vehicle.lastPacketMs, nowMs)) : null;
  const free = vehicle ? Math.max(0, VEHICLE_CAPACITY_SEATS - vehicle.seatsTaken) : 0;
  // The distance shows also while the ETA is hidden (slow or over 10 km, PRD 19.4)
  const distanceKm = etaDistanceKm(eta);
  // No position for COVERAGE_LIVE_MAX_AGE_S: the time is hidden and the marker is Estimated (CF1)
  const stale = eta?.kind === 'unknown' && eta.reason === 'stale';

  // PRD 19.4: past ETA_MAX_KM the time is hidden; the headline says why (Emjay, 2026-10-26)
  const headline =
    eta?.kind === 'approaching'
      ? t.minutes(eta.etaS)
      : eta?.kind === 'passed'
        ? t.passed
        : eta?.kind === 'unknown' && eta.reason === 'too_far'
          ? t.tooFar(ETA_MAX_KM)
          : vehicle
            ? t.unknown
            : t.lost;
  const segments = [
    { label: progress.passed?.code ?? '—', caption: t.departed, done: true },
    { label: progress.next?.code ?? '—', caption: t.next, done: eta?.kind === 'passed' },
    { label: progress.mine?.code ?? '—', caption: t.yourStop, done: eta?.kind === 'passed' },
  ];

  return (
    <View style={[styles.panel, elevation.level3]}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <View style={styles.etaRow}>
            <Text style={typography.headlineLg}>{headline}</Text>
            {distanceKm !== null ? (
              <Text style={typography.bodySm}>
                {etaTarget === 'mine' && progress.mine ? t.awayTo(distanceKm, progress.mine.code) : t.away(distanceKm)}
              </Text>
            ) : null}
          </View>
          {/* Emjay, 2026-10-26: the stop being approached is on the bar below, so the badge shows
              only what the bar cannot: a lost signal, a multicab gone past, or a time to its next stop */}
          {stale ? (
            <View style={styles.row}>
              <StatusPill label={t.signalLost} tone="warning" />
            </View>
          ) : passedMe ? (
            <View style={styles.row}>
              <StatusPill label={t.passedYou} tone="warning" />
            </View>
          ) : eta?.kind === 'approaching' && etaTarget === 'next' && progress.next ? (
            <View style={styles.row}>
              <StatusPill label={t.toNextStop(progress.next.code)} tone="neutral" />
            </View>
          ) : null}
        </View>
        {age ? (
          <View style={styles.updated}>
            <Text style={typography.labelSm}>{t.lastUpdated}</Text>
            <Text style={[typography.labelLg, styles.primary]}>{age}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.progress}>
        {segments.map((segment, index) => (
          <View key={index} style={styles.segment}>
            <View style={[styles.bar, segment.done || index === 0 ? styles.barDone : index === 1 ? styles.barNow : null]} />
            <Text style={typography.labelMd} numberOfLines={1}>
              {segment.label}
            </Text>
            <Text style={typography.bodySm}>{segment.caption}</Text>
          </View>
        ))}
      </View>

      {vehicle ? (
        <View style={styles.cards}>
          <View style={styles.card}>
            <IconTile icon={Bus} />
            <View style={styles.grow}>
              <Text style={typography.labelLg} numberOfLines={1}>
                {vehicle.label}
              </Text>
              <Text style={typography.bodySm}>{strings.live.vehicle.route(vehicle.routeCode)}</Text>
            </View>
          </View>
          <View style={styles.card}>
            <IconTile icon={Armchair} tone={TIER_TONE[seatTier(vehicle.seatsTaken)]} />
            <View style={styles.grow}>
              <Text style={[typography.labelLg, styles[TIER_TONE[seatTier(vehicle.seatsTaken)]]]}>{t.seatsOpen(free)}</Text>
              <Text style={typography.bodySm}>{t.onboard(vehicle.seatsTaken, VEHICLE_CAPACITY_SEATS)}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {alertMessage ? (
        <View style={styles.alert}>
          <BellRing color={colors.onPrimaryContainer} size={ICON_SIZE} />
          <Text style={[typography.labelLg, styles.alertText]}>{alertMessage}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.grow}>
          <Button
            label={alertOn ? t.alertOn : t.alert}
            leadingIcon={BellRing}
            variant={alertOn ? 'primary' : 'secondary'}
            onPress={onToggleAlert}
          />
        </View>
        <Pressable style={styles.stop} onPress={onStop} accessibilityRole="button" accessibilityLabel={t.stop}>
          <Square color={colors.onPrimary} size={ICON_SIZE} fill={colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  panel: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  etaRow: {
    flexDirection: 'row',
    // The distance moves under a long headline instead of being cut off by Last updated
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    paddingTop: spacing.xs,
  },
  updated: {
    alignItems: 'flex-end',
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLow,
  },
  primary: {
    color: colors.primary,
  },
  success: {
    color: colors.success,
  },
  warning: {
    color: colors.warning,
  },
  danger: {
    color: colors.danger,
  },
  progress: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    gap: spacing.xs,
  },
  bar: {
    height: SEGMENT_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
  },
  barDone: {
    backgroundColor: colors.success,
  },
  barNow: {
    backgroundColor: colors.primary,
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceLow,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.primaryContainer,
  },
  alertText: {
    flex: 1,
    color: colors.onPrimaryContainer,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stop: {
    width: STOP_BUTTON,
    height: STOP_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    // Stopping ends the session, so it reads as the red action
    backgroundColor: colors.danger,
  },
}));

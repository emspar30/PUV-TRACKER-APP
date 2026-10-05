import { Armchair, BellRing, Bus, Square } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Button, IconTile, StatusPill } from '@/components';
import { VEHICLE_CAPACITY_SEATS } from '@/shared/config';
import type { Eta, TrackProgress } from '@/shared/tracking/eta';
import { ageSeconds } from '@/shared/telemetry/coverage';
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
  alertOn: boolean;
  // Shown once the alert has fired
  alertMessage: string | null;
  onToggleAlert: () => void;
  onStop: () => void;
};

const STOP_BUTTON = MIN_TOUCH_TARGET + spacing.xs;
const SEGMENT_HEIGHT = spacing.xs;
const ICON_SIZE = spacing.md + spacing.xs;

// Tracking one multicab (L2, PRD 19.2 D9): the ETA to the commuter's stop, where the vehicle is among
// the stops, the vehicle and its seats, an in-app arrival alert, and Stop
export function TrackingPanel({ vehicle, nowMs, eta, progress, etaTarget = 'mine', alertOn, alertMessage, onToggleAlert, onStop }: TrackingPanelProps) {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  const t = strings.live.tracking;
  const age = vehicle ? strings.live.vehicle.ageSeconds(ageSeconds(vehicle.lastPacketMs, nowMs)) : null;
  const free = vehicle ? Math.max(0, VEHICLE_CAPACITY_SEATS - vehicle.seatsTaken) : 0;

  const headline =
    eta?.kind === 'approaching' ? t.minutes(eta.etaS) : eta?.kind === 'passed' ? t.passed : vehicle ? t.unknown : t.lost;
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
            {eta?.kind === 'approaching' ? <Text style={typography.bodySm}>{t.away(eta.distanceKm)}</Text> : null}
          </View>
          {eta?.kind === 'approaching' && etaTarget === 'next' && progress.next ? (
            <View style={styles.row}>
              <StatusPill label={t.toNextStop(progress.next.code)} tone="neutral" />
            </View>
          ) : eta?.kind === 'approaching' && progress.mine ? (
            <View style={styles.row}>
              <StatusPill label={t.approaching(progress.mine.code)} tone="success" />
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
              {age ? <Text style={typography.bodySm}>{t.synced(age)}</Text> : null}
            </View>
          </View>
          <View style={styles.card}>
            <IconTile icon={Armchair} tone="success" />
            <View style={styles.grow}>
              <Text style={[typography.labelLg, styles.success]}>{t.seatsOpen(free)}</Text>
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
            variant={alertOn ? 'success' : 'secondary'}
            onPress={onToggleAlert}
          />
        </View>
        <Pressable style={styles.stop} onPress={onStop} accessibilityRole="button" accessibilityLabel={t.stop}>
          <Square color={colors.textPrimary} size={ICON_SIZE} />
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
    borderWidth: 1,
    borderColor: colors.outline,
  },
}));

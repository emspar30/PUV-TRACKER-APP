import { BatteryState, useBatteryLevel, useBatteryState } from 'expo-battery';
import { BatteryCharging, BatteryMedium, Bluetooth, BluetoothOff, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import { describeBeacon } from '../beacon/beacon';
import type { Tone } from '../heatmap/describe';
import type { BeaconStatus } from '../../../../modules/tunton-beacon';

// The driver app's status strip (PRD 9.4): the beacon and the battery. Holding it for 3 s opens the
// admin PIN (Q12); a tap does nothing, so the driver is never asked to touch it (PRD 15.3).
// Owner, 2026-10-18: only these two pills. The last update shows in the list's heading and the red
// stale notice; the clock appears only as a warning on the home screen when it is off (PRD 8.2, 14);
// the battery says "Charging" only while charging, otherwise just its percentage.
// Look (Stitch design, 2026-10-12): a white floating bar like the commuter app's top bar, holding one
// status pill per item, tinted by its tone, as the commuter app's StatusPill; each pill takes half the
// row. Backlog 120: a label too long for its half wraps to a second line rather than losing its end.

const ICON = 16;
const DOT = spacing.sm;
const ADMIN_HOLD_MS = 3000;
const PERCENT = 100;
const LOW_BATTERY = 0.2;

type Props = { status: BeaconStatus; onAdminHold: () => void };

export function StatusStrip({ status, onAdminHold }: Props) {
  const styles = useStyles();
  const level = useBatteryLevel();
  const batteryState = useBatteryState();
  const beacon = describeBeacon(status);
  const charging = batteryState === BatteryState.CHARGING || batteryState === BatteryState.FULL;
  const batteryTone: Tone = charging ? 'ok' : level >= 0 && level < LOW_BATTERY ? 'bad' : 'warn';
  const percent = level >= 0 ? strings.driver.battery(Math.round(level * PERCENT)) : '—';
  const batteryLabel = charging ? `${percent} · ${strings.driver.charging}` : percent;

  return (
    <Pressable onLongPress={onAdminHold} delayLongPress={ADMIN_HOLD_MS} style={styles.strip} accessibilityLabel={strings.driver.holdForAdmin}>
      <View style={styles.row}>
        <StatusItem icon={status.bluetoothOn ? Bluetooth : BluetoothOff} tone={beacon.tone} label={beacon.label} />
        <StatusItem icon={charging ? BatteryCharging : BatteryMedium} tone={batteryTone} label={batteryLabel} />
      </View>
    </Pressable>
  );
}

function StatusItem({ icon: Icon, tone, label }: { icon: LucideIcon; tone: Tone; label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tones = {
    ok: { fill: colors.successContainer, text: colors.success },
    warn: { fill: colors.warningContainer, text: colors.warning },
    bad: { fill: colors.dangerContainer, text: colors.danger },
  };
  const { fill, text } = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: fill }]}>
      <Icon color={text} size={ICON} />
      <View style={[styles.dot, { backgroundColor: text }]} />
      <Text style={[styles.label, { color: text }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation, typography }) => ({
  strip: {
    minHeight: MIN_TOUCH_TARGET,
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
    ...elevation.level2,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  // Each pill takes half the row, whatever its text; a long label takes two lines
  pill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + spacing.xs / 2,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT,
  },
  label: {
    ...typography.labelMd,
    flexShrink: 1,
  },
}));

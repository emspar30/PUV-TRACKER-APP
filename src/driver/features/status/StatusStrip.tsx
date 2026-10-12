import { BatteryState, useBatteryLevel, useBatteryState } from 'expo-battery';
import { BatteryCharging, BatteryMedium, Bluetooth, BluetoothOff } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import { describeBeacon } from '../beacon/beacon';
import type { BeaconStatus } from '../../../../modules/tunton-beacon';

// The driver app's status strip (PRD 9.4): the beacon and the battery now; the last SMS and the clock
// come with the heatmap (DR5). Holding it for 3 s opens the admin PIN (Q12); a tap does nothing, so
// the driver is never asked to touch it (PRD 15.3).

const ICON = 22;
const ADMIN_HOLD_MS = 3000;
const PERCENT = 100;

type Props = { status: BeaconStatus; onAdminHold: () => void };

export function StatusStrip({ status, onAdminHold }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const level = useBatteryLevel();
  const batteryState = useBatteryState();
  const beacon = describeBeacon(status);
  const toneColor = beacon.tone === 'ok' ? colors.success : beacon.tone === 'warn' ? colors.warning : colors.danger;
  const charging = batteryState === BatteryState.CHARGING || batteryState === BatteryState.FULL;
  const BeaconIcon = status.bluetoothOn ? Bluetooth : BluetoothOff;
  const BatteryIcon = charging ? BatteryCharging : BatteryMedium;

  return (
    <Pressable
      onLongPress={onAdminHold}
      delayLongPress={ADMIN_HOLD_MS}
      style={styles.strip}
      accessibilityLabel={strings.driver.holdForAdmin}
    >
      <View style={styles.item}>
        <BeaconIcon color={toneColor} size={ICON} />
        <Text style={[typography.labelLg, { color: toneColor }]} numberOfLines={1}>
          {beacon.label}
        </Text>
      </View>
      <View style={styles.item}>
        <BatteryIcon color={charging ? colors.success : colors.warning} size={ICON} />
        <Text style={typography.labelLg} numberOfLines={1}>
          {`${level >= 0 ? strings.driver.battery(Math.round(level * PERCENT)) : '—'} · ${charging ? strings.driver.charging : strings.driver.notCharging}`}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  strip: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
}));

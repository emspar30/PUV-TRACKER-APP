import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { StatusPill } from '@/components';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;
const DOT_SIZE = spacing.sm + spacing.xs;
const DOT_RING = 3;
const BAR_HEIGHT = spacing.xs + 2;

// Pieces of the Check-in sheet (C1 UI pass), after Google Maps' place sheet: a few facts in tiles,
// a thin progress bar and one list row per station.

// One fact of the running check-in: an icon, a value and a caption
export function StatTile({ icon: Icon, value, caption }: { icon: LucideIcon; value: string; caption: string }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${value}, ${caption}`}>
      <Icon color={colors.primary} size={ICON_SIZE} />
      <Text style={[typography.labelLg, styles.center]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[typography.bodySm, styles.center]} numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

// The time left of a check-in as a bar that empties, with its label and the window length
export function ExpiryBar({ fraction, minutes }: { fraction: number; minutes: number }) {
  const styles = useStyles();
  const { typography } = useTheme();
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return (
    <View style={styles.expiry}>
      <View style={styles.between}>
        <Text style={typography.bodySm}>{strings.checkin.expires}</Text>
        <Text style={typography.bodySm}>{strings.checkin.window(minutes)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
      </View>
    </View>
  );
}

type StationRowProps = {
  name: string;
  meta: string;
  waiting: number;
  color: string;
  selected: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
};

// A station in the list: a dot in the route colour, the name, "RCA · 120 m", and the people waiting
export function StationRow({ name, meta, waiting, color, selected, onPress, accessibilityLabel }: StationRowProps) {
  const styles = useStyles();
  const { typography } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.dot, { borderColor: color }]} />
      <View style={styles.grow}>
        <Text style={typography.labelLg} numberOfLines={1}>
          {name}
        </Text>
        <Text style={typography.bodySm} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {waiting > 0 ? <StatusPill label={strings.checkin.waiting(waiting)} tone="success" /> : null}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  center: {
    textAlign: 'center',
  },
  expiry: {
    gap: spacing.xs + 2,
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: {
    height: BAR_HEIGHT,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceHigh,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  row: {
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs,
    borderRadius: radii.card,
  },
  rowSelected: {
    backgroundColor: colors.primaryContainer,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radii.pill,
    borderWidth: DOT_RING,
    backgroundColor: colors.card,
  },
  grow: {
    flex: 1,
  },
}));

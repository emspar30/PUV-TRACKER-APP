import { ChevronRight, Crosshair } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { IconTile } from '@/components';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

type TrackingBarProps = {
  // null while the multicab has no recent position
  label: string | null;
  routeCode: string;
  // "~4 min", or null when there is no ETA
  eta: string | null;
  onPress: () => void;
};

const ICON_SIZE = spacing.md + spacing.xs;

// B2: shown while another route is on the map and a multicab is still being tracked. A tap goes
// back to it: its route, centred on the vehicle, with the full tracking panel.
export function TrackingBar({ label, routeCode, eta, onPress }: TrackingBarProps) {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  const t = strings.live.tracking;
  return (
    <Pressable
      style={({ pressed }) => [styles.bar, elevation.level3, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.jumpTo}
    >
      <IconTile icon={Crosshair} />
      <View style={styles.grow}>
        <Text style={typography.labelLg} numberOfLines={1}>
          {t.barTitle(label)}
        </Text>
        <Text style={typography.bodySm} numberOfLines={1}>
          {t.barDetail(routeCode, eta)}
        </Text>
      </View>
      <ChevronRight color={colors.textSecondary} size={ICON_SIZE} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  grow: {
    flex: 1,
  },
}));

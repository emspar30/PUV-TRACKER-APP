import { X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { StatusPill, type StatusTone } from '@/components';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

type ActiveRouteCardProps = {
  code: string;
  name: string;
  color: string;
  // "3 active", "Stale · 4 min" or "No data"
  status: { label: string; tone: StatusTone };
  // L1: a short line beside the status, such as Night Mode's
  note?: string | null;
  onClose: () => void;
};

const BADGE = spacing.xl + spacing.sm;
const ICON_SIZE = spacing.md + spacing.xs;

// The picked route, under the top bar (restyle): its badge, name and live status. No direction
// label: commuters read the way a vehicle goes from its icon on the map.
export function ActiveRouteCard({ code, name, color, status, note, onClose }: ActiveRouteCardProps) {
  const styles = useStyles();
  const { colors, typography, routeBadgeText, elevation } = useTheme();
  return (
    <View style={[styles.card, elevation.level2]}>
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={[typography.labelLg, { color: routeBadgeText }]}>{code}</Text>
      </View>
      <View style={styles.text}>
        <Text style={typography.labelLg} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.meta}>
          <StatusPill label={status.label} tone={status.tone} />
          {note ? (
            <Text style={[typography.bodySm, styles.note]} numberOfLines={1}>
              {note}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable style={styles.icon} onPress={onClose} accessibilityRole="button" accessibilityLabel={strings.live.active.close}>
        <X color={colors.textPrimary} size={ICON_SIZE} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm + spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.card,
  },
  badge: {
    width: BADGE,
    height: BADGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  note: {
    flexShrink: 1,
  },
  icon: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

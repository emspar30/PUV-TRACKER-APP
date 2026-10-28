import { ChevronRight } from 'lucide-react-native';
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
  // The card opens the route list; its chevron folds it back into the Routes button and shows All
  // routes again (Emjay, 2026-10-26: it replaced the Hide route X)
  onPress: () => void;
  onCollapse: () => void;
};

const BADGE = spacing.xl + spacing.sm;
const ICON_SIZE = spacing.md + spacing.xs;

// The picked route, under the top bar (restyle): its badge, name and live status. No direction
// label: commuters read the way a vehicle goes from its icon on the map.
export function ActiveRouteCard({ code, name, color, status, note, onPress, onCollapse }: ActiveRouteCardProps) {
  const styles = useStyles();
  const { colors, typography, routeBadgeText, elevation } = useTheme();
  return (
    <View style={[styles.card, elevation.level2]}>
      <Pressable
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={strings.live.active.change}
      >
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
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
        onPress={onCollapse}
        accessibilityRole="button"
        accessibilityLabel={strings.live.active.collapse}
      >
        <ChevronRight color={colors.textSecondary} size={ICON_SIZE} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.card,
    backgroundColor: colors.card,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm + spacing.xs,
    paddingVertical: spacing.sm,
    borderTopLeftRadius: radii.card,
    borderBottomLeftRadius: radii.card,
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
  pressed: {
    backgroundColor: colors.surface,
  },
  icon: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
}));

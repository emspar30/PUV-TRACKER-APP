import { ArrowRight, RadioTower } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

type CoverageNudgeProps = {
  code: string;
  // A route that shares a stop with this one and has a Live multicab nearby, or null
  alternative: { routeCode: string; distanceM: number; color: string } | null;
  onShare: () => void;
  onAlternative: (code: string) => void;
};

const ICON_SIZE = spacing.md + spacing.xs;
const SMALL_ICON = spacing.md;

// CF1 coverage nudge, under the picked route's card when it has no Live multicab: asks riders on it
// to share their seats (opens Relay) and, when an overlapping route has one nearby, offers that route.
export function CoverageNudge({ code, alternative, onShare, onAlternative }: CoverageNudgeProps) {
  const styles = useStyles();
  const { colors, typography, routeBadgeText, elevation } = useTheme();
  return (
    <View style={[styles.card, elevation.level2]}>
      <View style={styles.text}>
        <Text style={typography.labelLg}>{strings.live.nudge.title(code)}</Text>
        <Text style={typography.bodySm}>{strings.live.nudge.body}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.share} onPress={onShare} accessibilityRole="button" accessibilityLabel={strings.live.nudge.share}>
          <RadioTower color={colors.onPrimary} size={SMALL_ICON} />
          <Text style={[typography.labelMd, { color: colors.onPrimary }]}>{strings.live.nudge.share}</Text>
        </Pressable>
        {alternative ? (
          <Pressable
            style={styles.chip}
            onPress={() => onAlternative(alternative.routeCode)}
            accessibilityRole="button"
            accessibilityLabel={strings.live.nudge.alternativeLabel(alternative.routeCode)}
          >
            <View style={[styles.dot, { backgroundColor: alternative.color }]}>
              <Text style={[typography.labelSm, { color: routeBadgeText }]}>{alternative.routeCode}</Text>
            </View>
            <Text style={[typography.labelMd, styles.chipText]} numberOfLines={1}>
              {strings.live.nudge.alternative(alternative.routeCode, alternative.distanceM)}
            </Text>
            <ArrowRight color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.card,
  },
  text: {
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  share: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  dot: {
    minWidth: spacing.xl,
    height: spacing.lg,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  chipText: {
    flexShrink: 1,
  },
}));

import { CircleAlert } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { LineBadge } from '@/components';
import type { FailureExplanation } from '@/shared/routing/explainFailure';
import type { PlanFailureResult } from '@/shared/routing/plan';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;

type RideFailureProps = {
  failure: PlanFailureResult;
  // Why, in the rider's terms (direction not mapped, or no single route serves both points)
  explanation: FailureExplanation;
  // The fix offered under the message, such as "Move pin to the route"
  action: { label: string; onPress: () => void } | null;
  badgeColor: (code: string) => string;
};

// Why no trip was found, in a few words with the number, and one way out
export function RideFailure({ failure, explanation, action, badgeColor }: RideFailureProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const distanceM = failure.reason === 'destination_too_far' ? failure.destinationDistanceM : failure.originDistanceM;
  const tooFar = explanation.kind === 'as_planned' && (failure.reason === 'origin_too_far' || failure.reason === 'destination_too_far');
  const message =
    explanation.kind === 'not_mapped'
      ? strings.ride.notMapped(explanation.routeCode)
      : explanation.kind === 'different_routes'
        ? strings.ride.differentRoutes
        : strings.ride.failure[failure.reason](distanceM);
  return (
    <View style={[styles.card, styles.failure]}>
      <View style={styles.row}>
        <CircleAlert color={colors.danger} size={ICON_SIZE} />
        <Text style={[typography.labelLg, styles.danger, styles.grow]}>{message}</Text>
      </View>
      {explanation.kind === 'different_routes'
        ? (
            [
              [strings.ride.nearFrom, explanation.originRoutes],
              [strings.ride.nearTo, explanation.destinationRoutes],
            ] as const
          ).map(([label, codes]) => (
            <View key={label} style={styles.row}>
              <Text style={typography.bodySm}>{label}</Text>
              {codes.map((code) => (
                <LineBadge key={code} code={code} color={badgeColor(code)} />
              ))}
            </View>
          ))
        : null}
      {tooFar ? <Text style={typography.bodySm}>{strings.ride.walkLimit(failure.maxWalkM)}</Text> : null}
      {action ? (
        <Pressable style={styles.action} onPress={action.onPress} accessibilityRole="button">
          <Text style={[typography.labelLg, styles.actionText]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    gap: spacing.sm + spacing.xs,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLow,
  },
  failure: {
    backgroundColor: colors.dangerContainer,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  danger: {
    color: colors.danger,
  },
  action: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.sheet,
  },
  actionText: {
    color: colors.primary,
  },
}));

import { Bus, ChevronDown, ChevronUp, Footprints } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FARE_DISCOUNTED_CLASSES, type Classification } from '@/shared/config';
import type { FareResult } from '@/shared/fare/fare';
import type { Itinerary, PlanFailureResult } from '@/shared/routing/plan';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;
const PERCENT = 100;
const { peso } = strings.format;

export type FailureAction = {
  label: string;
  onPress: () => void;
};

type TripFailureProps = {
  failure: PlanFailureResult;
  // Ways out offered under the message, such as moving a pin onto the route
  actions: FailureAction[];
};

// Says why no trip was found, with the distance involved, and offers a fix where there is one
export function TripFailure({ failure, actions }: TripFailureProps) {
  const styles = useStyles();
  const { typography } = useTheme();
  const distanceM = failure.reason === 'destination_too_far' ? failure.destinationDistanceM : failure.originDistanceM;
  return (
    <View style={styles.card}>
      <Text style={typography.body}>{strings.plan.failureTitle}</Text>
      <Text style={typography.caption}>{strings.plan.failure[failure.reason](distanceM, failure.maxWalkM)}</Text>
      {actions.map((action) => (
        <Pressable key={action.label} style={styles.action} onPress={action.onPress} accessibilityRole="button">
          <Text style={typography.body}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

type TripResultProps = {
  itinerary: Itinerary;
  fare: FareResult;
  classification: Classification;
  isPlaceholder: boolean;
};

export function TripResult({ itinerary, fare, classification, isPlaceholder }: TripResultProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const [walkIn, ride, walkOut] = itinerary.legs;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const Chevron = showBreakdown ? ChevronUp : ChevronDown;

  return (
    <>
      <View style={styles.card}>
        <Text style={typography.body}>{strings.plan.itinerary}</Text>
        <Step icon="walk" text={strings.plan.walkToRoute(walkIn.distanceM)} />
        <Step
          icon="ride"
          text={strings.plan.ride(ride.routeCode, strings.direction.lower[ride.direction], ride.distanceKm)}
        />
        <Step icon="walk" text={strings.plan.walkToDestination(walkOut.distanceM)} />
      </View>

      <View style={styles.card}>
        <View style={styles.spread}>
          <Text style={typography.body}>{strings.plan.fare}</Text>
          <Text style={styles.amber}>{strings.plan.estimateOnly}</Text>
        </View>
        <Text style={typography.title}>{peso(fare.rounded)}</Text>
        <Text style={typography.caption}>{strings.plan.notOfficial}</Text>

        <Pressable
          style={styles.toggle}
          onPress={() => setShowBreakdown((shown) => !shown)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showBreakdown }}
        >
          <Text style={[typography.body, styles.grow]}>
            {showBreakdown ? strings.plan.hideBreakdown : strings.plan.showBreakdown}
          </Text>
          <Chevron color={colors.textSecondary} size={ICON_SIZE} />
        </Pressable>

        {showBreakdown ? <FareBreakdownRows fare={fare} classification={classification} /> : null}

        {isPlaceholder ? <Text style={styles.amber}>{strings.common.placeholderDetail}</Text> : null}
      </View>
    </>
  );
}

// The fare, one line per step: base, extra kilometres, discount, rounding, total
function FareBreakdownRows({ fare, classification }: { fare: FareResult; classification: Classification }) {
  const styles = useStyles();
  const { typography } = useTheme();
  const { breakdown } = fare;
  const label = strings.classification.labels[classification];
  const discounted = FARE_DISCOUNTED_CLASSES.includes(classification);
  const percentOff = Math.round((1 - breakdown.multiplier) * PERCENT);

  return (
    <View style={styles.breakdown}>
      <Row label={strings.plan.breakdownBase(breakdown.baseKm)} amount={peso(breakdown.baseFare)} />
      <Row
        label={
          breakdown.extraKm > 0
            ? strings.plan.breakdownExtra(breakdown.extraKm, breakdown.perKmRate)
            : strings.plan.breakdownExtraNone(breakdown.baseKm)
        }
        amount={`+ ${peso(breakdown.extraCost)}`}
      />
      <Row label={strings.plan.breakdownRegular} amount={peso(fare.gross)} />
      <Row
        label={discounted ? strings.plan.breakdownDiscount(label, percentOff) : strings.plan.breakdownNoDiscount(label)}
        amount={`- ${peso(breakdown.discount)}`}
      />
      {breakdown.roundingStep !== null ? (
        <Row
          label={strings.plan.breakdownRounding(breakdown.roundingStep)}
          amount={`${breakdown.roundingAdjustment < 0 ? '-' : '+'} ${peso(Math.abs(breakdown.roundingAdjustment))}`}
        />
      ) : null}
      <View style={styles.rule} />
      <Row label={strings.plan.breakdownTotal} amount={peso(fare.rounded)} strong />
      <Text style={typography.caption}>{strings.plan.changeClassification}</Text>
    </View>
  );
}

function Row({ label, amount, strong = false }: { label: string; amount: string; strong?: boolean }) {
  const styles = useStyles();
  const { typography } = useTheme();
  const style = strong ? typography.body : typography.caption;
  return (
    <View style={styles.row}>
      <Text style={[style, styles.grow]}>{label}</Text>
      <Text style={style}>{amount}</Text>
    </View>
  );
}

function Step({ icon, text }: { icon: 'walk' | 'ride'; text: string }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const Icon = icon === 'walk' ? Footprints : Bus;
  return (
    <View style={styles.step}>
      <Icon color={colors.textSecondary} size={ICON_SIZE} />
      <Text style={[typography.body, styles.grow]}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  spread: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  amber: {
    ...typography.caption,
    color: colors.warning,
  },
  toggle: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  breakdown: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.textSecondary,
  },
  action: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
}));

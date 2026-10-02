import { Bus, Footprints } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { CLASSIFICATION_LABELS } from '@/features/profile/classificationLabels';
import { FARE_DISCOUNTED_CLASSES, MAX_WALK_PER_LEG_M, type Classification } from '@/shared/config';
import type { FareResult } from '@/shared/fare/fare';
import type { Itinerary, PlanFailure } from '@/shared/routing/plan';
import { colors, radii, spacing, typography } from '@/theme';

import { formatKm, formatPeso, formatWalk } from './format';

const ICON_SIZE = spacing.md + spacing.xs;
const DIRECTION_LABEL = { outbound: 'outbound', return: 'return' } as const;

const FAILURE_TEXT: Record<PlanFailure, string> = {
  origin_too_far: `The origin is more than ${MAX_WALK_PER_LEG_M} m from the route. Pick a point closer to the line.`,
  destination_too_far: `The destination is more than ${MAX_WALK_PER_LEG_M} m from the route. Pick a point closer to the line.`,
  destination_not_ahead:
    'No trip in this direction: the destination is not ahead of the origin along the route. Try swapping the two points.',
  no_routes: 'No route data is available.',
};

export function TripFailure({ reason }: { reason: PlanFailure }) {
  return (
    <View style={styles.card}>
      <Text style={typography.body}>No trip found</Text>
      <Text style={typography.caption}>{FAILURE_TEXT[reason]}</Text>
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
  const [walkIn, ride, walkOut] = itinerary.legs;
  const discounted = FARE_DISCOUNTED_CLASSES.includes(classification);

  return (
    <>
      <View style={styles.card}>
        <Text style={typography.body}>Itinerary</Text>
        <Step icon="walk" text={`Walk ${formatWalk(walkIn.distanceM)} to the route`} />
        <Step
          icon="ride"
          text={`Ride Route ${ride.routeCode} (${DIRECTION_LABEL[ride.direction]}) for ${formatKm(ride.distanceKm)}`}
        />
        <Step icon="walk" text={`Walk ${formatWalk(walkOut.distanceM)} to the destination`} />
      </View>

      <View style={styles.card}>
        <View style={styles.fareRow}>
          <Text style={typography.body}>Fare</Text>
          <Text style={styles.estimate}>Estimate only</Text>
        </View>
        <Text style={typography.title}>{formatPeso(fare.rounded)}</Text>
        <Text style={typography.caption}>
          {discounted
            ? `${CLASSIFICATION_LABELS[classification]} discount applied. Regular fare ${formatPeso(fare.gross)}.`
            : `${CLASSIFICATION_LABELS[classification]} fare. Change your classification in Profile.`}
        </Text>
        <Text style={typography.caption}>
          Based on {formatKm(ride.distanceKm)} along the route. Walking does not change the fare. This is not the
          official fare.
        </Text>
        {isPlaceholder ? (
          <Text style={styles.placeholder}>Route and fare values are placeholder data, not yet confirmed.</Text>
        ) : null}
      </View>
    </>
  );
}

function Step({ icon, text }: { icon: 'walk' | 'ride'; text: string }) {
  const Icon = icon === 'walk' ? Footprints : Bus;
  return (
    <View style={styles.step}>
      <Icon color={colors.textMuted} size={ICON_SIZE} />
      <Text style={[typography.body, styles.stepText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  stepText: {
    flex: 1,
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  estimate: {
    ...typography.caption,
    color: colors.amber,
  },
  placeholder: {
    ...typography.caption,
    color: colors.amber,
  },
});

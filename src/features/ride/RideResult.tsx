import { ChevronDown, ChevronUp, CircleAlert, Footprints, Map as MapIcon, PhilippinePeso } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Chip, LineBadge, StatusPill } from '@/components';
import { DRAFT_ROUTE_CODES } from '@/data/seed/routes';
import type { Classification } from '@/shared/config';
import type { FareResult } from '@/shared/fare/fare';
import type { FailureExplanation } from '@/shared/routing/explainFailure';
import type { Itinerary, PlanFailureResult } from '@/shared/routing/plan';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import { FareBreakdown } from './FareBreakdown';
import { QuickFareTypeChip } from './FareTypeChips';

const ICON_SIZE = spacing.md + spacing.xs;
const PESO_ICON_SIZE = spacing.xl;
const FARE_DECIMALS = 2;

type RideResultProps = {
  itinerary: Itinerary;
  fare: FareResult;
  classification: Classification;
  badgeColor: string;
  // Nearest stops to where the rider boards and gets off
  boardNear: string;
  getOffNear: string;
  onViewOnMap: () => void;
};

// The trip as one card: route, where to board and get off, the fare as the big number, and the
// working behind "Details". The fare comes from the shared engine; this card only shows it.
export function RideResult({
  itinerary,
  fare,
  classification,
  badgeColor,
  boardNear,
  getOffNear,
  onViewOnMap,
}: RideResultProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const [walkIn, ride, walkOut] = itinerary.legs;
  const [showDetails, setShowDetails] = useState(false);
  const Chevron = showDetails ? ChevronUp : ChevronDown;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <LineBadge code={ride.routeCode} color={badgeColor} />
        <View style={styles.grow}>
          <Text style={typography.labelLg}>{strings.ride.boardNear(boardNear)}</Text>
          <Text style={typography.labelLg}>{strings.ride.getOffNear(getOffNear)}</Text>
        </View>
        {/* RR2: the route's two legs are not both from Emjay's files yet */}
        {DRAFT_ROUTE_CODES.has(ride.routeCode) ? <Chip label={strings.common.draft} /> : null}
      </View>

      <View style={styles.row} accessible accessibilityLabel={strings.ride.fare(fare.rounded)}>
        <PhilippinePeso color={colors.textPrimary} size={PESO_ICON_SIZE} />
        <Text style={typography.display}>{fare.rounded.toFixed(FARE_DECIMALS)}</Text>
      </View>

      <View style={styles.chips}>
        <Chip label={strings.ride.rideKm(ride.distanceKm)} />
        <StatusPill label={strings.ride.estimate} tone="warning" />
      </View>
      <QuickFareTypeChip />

      <View style={styles.row}>
        <Footprints color={colors.textSecondary} size={ICON_SIZE} />
        <Text style={typography.bodySm}>
          {strings.ride.walk(walkIn.distanceM)} · {strings.ride.walk(walkOut.distanceM)}
        </Text>
      </View>

      <Pressable
        style={styles.toggle}
        onPress={() => setShowDetails((shown) => !shown)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showDetails }}
      >
        <Text style={[typography.labelLg, styles.grow]}>{showDetails ? strings.ride.hideDetails : strings.ride.details}</Text>
        <Chevron color={colors.textSecondary} size={ICON_SIZE} />
      </Pressable>
      {showDetails ? (
        <View style={styles.details}>
          <Text style={typography.bodySm}>{strings.ride.walkToRoute(strings.ride.from, walkIn.distanceM)}</Text>
          <Text style={typography.bodySm}>{strings.ride.walkToRoute(strings.ride.to, walkOut.distanceM)}</Text>
          <FareBreakdown fare={fare} classification={classification} />
        </View>
      ) : null}

      <Pressable style={styles.action} onPress={onViewOnMap} accessibilityRole="button">
        <MapIcon color={colors.primary} size={ICON_SIZE} />
        <Text style={[typography.labelLg, styles.actionText]}>{strings.ride.viewOnMap}</Text>
      </Pressable>
    </View>
  );
}

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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggle: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  details: {
    gap: spacing.sm,
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

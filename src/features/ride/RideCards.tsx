import { ChevronDown, ChevronUp, Footprints, Map as MapIcon, Route, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Chip, IconTile } from '@/components';
import { DRAFT_ROUTE_CODES } from '@/data/seed/routes';
import { FARE_DISCOUNT_MULTIPLIER, type Classification } from '@/shared/config';
import type { FareResult } from '@/shared/fare/fare';
import type { Itinerary } from '@/shared/routing/plan';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import { FareBreakdown } from './FareBreakdown';

const PERCENT = 100;
const DISCOUNT_PERCENT = Math.round((1 - FARE_DISCOUNT_MULTIPLIER) * PERCENT);
const BADGE = spacing.xl + spacing.sm;
const SMALL_ICON = spacing.md;
const FARE_DECIMALS = 2;

// Distance and fare of the planned trip (restyle). A discounted fare shows the regular one struck
// through and a chip with the fare type.
export function FareSummaryCard({
  itinerary,
  fare,
  regularFare,
  classification,
}: {
  itinerary: Itinerary;
  fare: FareResult;
  regularFare: number;
  classification: Classification;
}) {
  const styles = useStyles();
  const { typography } = useTheme();
  const [open, setOpen] = useState(false);
  const discounted = fare.rounded < regularFare;
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <IconTile icon={Route} />
        <View style={styles.grow}>
          <Text style={typography.labelSm}>{strings.ride.distance}</Text>
          <Text style={typography.labelLg}>{strings.ride.summary(itinerary.rideKm, itinerary.walkM)}</Text>
        </View>
        <View style={styles.fare}>
          {discounted ? (
            <Text style={[typography.bodySm, styles.struck]} accessibilityLabel={strings.ride.regularWas(regularFare)}>
              ₱{regularFare.toFixed(FARE_DECIMALS)}
            </Text>
          ) : null}
          <Text style={[typography.headlineMd, styles.amount]}>₱{fare.rounded.toFixed(FARE_DECIMALS)}</Text>
        </View>
      </View>
      <View style={styles.row}>
        {discounted ? (
          <View style={styles.discount}>
            <Text style={[typography.labelSm, styles.discountText]}>
              {strings.ride.discountChip(DISCOUNT_PERCENT, strings.classification.short[classification])}
            </Text>
          </View>
        ) : null}
        <View style={styles.grow} />
        <Pressable style={styles.details} onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          <Text style={[typography.labelLg, styles.link]}>{strings.ride.fareDetails}</Text>
          <Chevron color={styles.link.color} size={SMALL_ICON} />
        </Pressable>
      </View>
      {open ? <FareBreakdown fare={fare} classification={classification} /> : null}
    </View>
  );
}

// The suggested route for the trip (restyle): where to board and get off, and the ways on
export function SuggestedRouteCard({
  itinerary,
  routeName,
  color,
  boardAt,
  getOffAt,
  onViewOnMap,
  onCheckin,
}: {
  itinerary: Itinerary;
  routeName: string;
  color: string;
  boardAt: string;
  getOffAt: string;
  onViewOnMap: () => void;
  onCheckin: () => void;
}) {
  const styles = useStyles();
  const { colors, typography, routeBadgeText } = useTheme();
  const [walkIn, ride, walkOut] = itinerary.legs;
  return (
    <View style={[styles.card, styles.suggested]}>
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={[typography.labelLg, { color: routeBadgeText }]}>{ride.routeCode}</Text>
        </View>
        <View style={styles.grow}>
          <View style={styles.titleRow}>
            <Text style={typography.headlineSm}>{routeName}</Text>
            <View style={styles.best}>
              <Text style={[typography.labelSm, styles.bestText]}>{strings.ride.bestMatch}</Text>
            </View>
          </View>
          {DRAFT_ROUTE_CODES.has(ride.routeCode) ? <Chip label={strings.common.draft} /> : null}
        </View>
      </View>
      <View style={styles.steps}>
        <View style={styles.step}>
          <Footprints color={colors.textSecondary} size={SMALL_ICON} />
          <Text style={[typography.labelLg, styles.grow]} numberOfLines={1}>
            {strings.ride.boardAt(boardAt)}
          </Text>
          <View style={styles.walk}>
            <Text style={[typography.labelSm, styles.link]}>{strings.ride.walkTo(walkIn.distanceM)}</Text>
          </View>
        </View>
        <View style={styles.step}>
          <MapIcon color={colors.textSecondary} size={SMALL_ICON} />
          <Text style={[typography.labelLg, styles.grow]} numberOfLines={1}>
            {strings.ride.getOffAt(getOffAt)}
          </Text>
          <View style={styles.walk}>
            <Text style={[typography.labelSm, styles.link]}>{strings.ride.walkTo(walkOut.distanceM)}</Text>
          </View>
        </View>
      </View>
      <Button label={strings.ride.viewRouteOnMap(ride.routeCode)} leadingIcon={MapIcon} onPress={onViewOnMap} />
      <Text style={[typography.labelSm, styles.center]}>{strings.ride.or.toUpperCase()}</Text>
      <Button label={strings.ride.stationsCheckin} leadingIcon={ShieldCheck} variant="secondary" onPress={onCheckin} />
      <Text style={[typography.bodySm, styles.center]}>{strings.ride.checkinNote}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    gap: spacing.sm + spacing.xs,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  suggested: {
    borderLeftWidth: spacing.xs,
    borderLeftColor: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  grow: {
    flex: 1,
  },
  fare: {
    alignItems: 'flex-end',
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  amount: {
    color: colors.primary,
  },
  discount: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.pill,
    backgroundColor: colors.successContainer,
  },
  discountText: {
    color: colors.success,
  },
  details: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  link: {
    color: colors.primary,
  },
  badge: {
    width: BADGE,
    height: BADGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BADGE,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  best: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.pill,
    backgroundColor: colors.successContainer,
  },
  bestText: {
    color: colors.success,
  },
  steps: {
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLow,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  walk: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryContainer,
  },
  center: {
    textAlign: 'center',
  },
}));

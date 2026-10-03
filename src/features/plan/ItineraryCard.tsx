import { Bus, Footprints, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { BentoCard } from '@/components';
import type { Itinerary } from '@/shared/routing/plan';
import { strings } from '@/strings';
import { colors, spacing, typography } from '@/theme';

import { formatKm, formatWalk } from './format';

const ICON_SIZE = 20;

type Step = { icon: LucideIcon; color: string; text: string };

// Walk, ride, walk steps (PRD 7.2 rule 6)
export function ItineraryCard({ itinerary }: { itinerary: Itinerary }) {
  const [walkIn, ride, walkOut] = itinerary.legs;
  const steps: Step[] = [
    { icon: Footprints, color: colors.textMuted, text: strings.plan.walkToRoute(formatWalk(walkIn.distanceM)) },
    { icon: Bus, color: ride.routeColor, text: strings.plan.ride(ride.routeName, formatKm(ride.distanceKm)) },
    {
      icon: Footprints,
      color: colors.textMuted,
      text: strings.plan.walkToDestination(formatWalk(walkOut.distanceM)),
    },
  ];

  return (
    <BentoCard span={2}>
      <Text style={typography.caption}>{strings.plan.steps}</Text>
      {steps.map(({ icon: Icon, color, text }, index) => (
        <View key={index} style={styles.step}>
          <Icon color={color} size={ICON_SIZE} />
          <Text style={[typography.body, styles.text]}>{text}</Text>
        </View>
      ))}
    </BentoCard>
  );
}

const styles = StyleSheet.create({
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    flex: 1,
  },
});

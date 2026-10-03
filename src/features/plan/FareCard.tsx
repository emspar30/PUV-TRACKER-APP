import { StyleSheet, Text } from 'react-native';

import { BentoCard } from '@/components';
import { FARE_ROUNDING_STEP_PHP, type Classification } from '@/shared/config';
import type { FareParams } from '@/shared/fare/fare';
import type { Itinerary } from '@/shared/routing/plan';
import { strings } from '@/strings';
import { colors, typography } from '@/theme';

import { formatKm, formatPercent, formatPeso } from './format';

type FareCardProps = {
  itinerary: Itinerary;
  fareParams: FareParams;
  classification: Classification | null;
  multiplier: number;
};

// Distance, fare and discount, always labelled as an estimate (PRD 7.2)
export function FareCard({ itinerary, fareParams, classification, multiplier }: FareCardProps) {
  const { fare } = itinerary;
  const discounted = multiplier < 1;
  const rounded = fare.rounded !== fare.unrounded && FARE_ROUNDING_STEP_PHP !== null;

  return (
    <BentoCard span={2}>
      <Text style={typography.caption}>{strings.plan.fareTitle}</Text>
      <Text style={styles.amount} accessibilityRole="header">
        {formatPeso(fare.rounded)}
      </Text>
      <Text style={typography.body}>
        {discounted && classification
          ? strings.plan.fareDiscounted(strings.classifications[classification], formatPercent(1 - multiplier))
          : strings.plan.fareRegular}
      </Text>
      {rounded && FARE_ROUNDING_STEP_PHP !== null && (
        <Text style={typography.caption}>
          {strings.plan.fareBeforeRounding(formatPeso(fare.unrounded), formatPeso(FARE_ROUNDING_STEP_PHP))}
        </Text>
      )}
      <Text style={typography.caption}>
        {strings.plan.fareDistance}: {formatKm(itinerary.legs[1].distanceKm)}
      </Text>
      <Text style={typography.caption}>
        {strings.plan.fareRule(
          formatPeso(fareParams.baseFare),
          formatKm(fareParams.baseKm),
          formatPeso(fareParams.perKmRate),
        )}
      </Text>
      {!classification && <Text style={typography.caption}>{strings.plan.fareSetClassification}</Text>}
      <Text style={[typography.caption, styles.note]}>{strings.plan.fareNote}</Text>
    </BentoCard>
  );
}

const styles = StyleSheet.create({
  amount: {
    ...typography.title,
    color: colors.primary,
  },
  note: {
    color: colors.warning,
  },
});

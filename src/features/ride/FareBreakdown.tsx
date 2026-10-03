import { StyleSheet, Text, View } from 'react-native';

import { FARE_DISCOUNTED_CLASSES, type Classification } from '@/shared/config';
import type { FareResult } from '@/shared/fare/fare';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

const PERCENT = 100;
const { peso } = strings.format;

// How the fare was worked out, one line per step: base, extra kilometres, regular fare, discount,
// rounding, total. It only displays the result of the shared fare engine (src/shared/fare).
export function FareBreakdown({ fare, classification }: { fare: FareResult; classification: Classification }) {
  const styles = useStyles();
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
    </View>
  );
}

function Row({ label, amount, strong = false }: { label: string; amount: string; strong?: boolean }) {
  const styles = useStyles();
  const { typography } = useTheme();
  const style = strong ? typography.labelLg : typography.bodySm;
  return (
    <View style={styles.row}>
      <Text style={[style, styles.grow]}>{label}</Text>
      <Text style={style}>{amount}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  breakdown: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  grow: {
    flex: 1,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outline,
  },
}));

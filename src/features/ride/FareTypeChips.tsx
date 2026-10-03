import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Chip } from '@/components';
import { CLASSIFICATIONS } from '@/shared/config';
import { useFareType } from '@/state/fareType';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md;

// The four fare types as chips. Used in Settings and, behind a quick chip, on the My Ride result.
// Both read and write the same stored classification through useFareType.
export function FareTypeChips() {
  const styles = useStyles();
  const [fareType, setFareType] = useFareType();
  return (
    <View style={styles.row}>
      {CLASSIFICATIONS.map((option) => (
        <Chip
          key={option}
          label={strings.classification.short[option]}
          accessibilityLabel={strings.classification.labels[option]}
          selected={option === fareType}
          onPress={() => setFareType(option)}
        />
      ))}
    </View>
  );
}

// A compact chip showing the current fare type; tapping it opens the four choices in place
export function QuickFareTypeChip() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const [fareType] = useFareType();
  const [open, setOpen] = useState(false);
  const label = strings.classification.short[fareType];

  return (
    <View style={styles.quick}>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={strings.ride.changeFareType(strings.classification.labels[fareType])}
      >
        <Text style={[typography.labelLg, styles.triggerText]}>{label}</Text>
        <ChevronDown color={colors.onPrimaryContainer} size={ICON_SIZE} />
      </Pressable>
      {open ? <FareTypeChips /> : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  quick: {
    gap: spacing.xs,
  },
  trigger: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryContainer,
  },
  triggerText: {
    color: colors.onPrimaryContainer,
  },
}));

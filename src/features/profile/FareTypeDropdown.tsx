import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CLASSIFICATIONS, FARE_DISCOUNT_MULTIPLIER, FARE_DISCOUNTED_CLASSES, type Classification } from '@/shared/config';
import { useFareType } from '@/state/fareType';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;
const PERCENT = 100;
const DISCOUNT_PERCENT = Math.round((1 - FARE_DISCOUNT_MULTIPLIER) * PERCENT);

const labelOf = (option: Classification) =>
  FARE_DISCOUNTED_CLASSES.includes(option)
    ? [strings.classification.labels[option], strings.onboarding.discount(DISCOUNT_PERCENT)].join(' · ')
    : strings.classification.labels[option];

// B7: the fare type as one compact row; a tap drops the four choices below it, a pick closes it
export function FareTypeDropdown() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const [fareType, setFareType] = useFareType();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View style={styles.box}>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={strings.profilePage.fareTypeLabel(strings.classification.labels[fareType])}
      >
        <Text style={[typography.labelMd, styles.muted]}>{strings.profilePage.fareType}</Text>
        <Text style={[typography.labelLg, styles.grow]} numberOfLines={1}>
          {labelOf(fareType)}
        </Text>
        <Chevron color={colors.textSecondary} size={ICON_SIZE} />
      </Pressable>
      {open ? (
        <View accessibilityRole="radiogroup">
          {CLASSIFICATIONS.map((option) => {
            const selected = option === fareType;
            return (
              <Pressable
                key={option}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                onPress={() => {
                  setFareType(option);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[typography.bodyMd, styles.grow, selected && styles.selected]}>{labelOf(option)}</Text>
                {selected ? <Check color={colors.primary} size={ICON_SIZE} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  box: {
    alignSelf: 'stretch',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  trigger: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  option: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  grow: {
    flex: 1,
  },
  muted: {
    color: colors.textSecondary,
  },
  selected: {
    color: colors.primary,
    fontWeight: '600',
  },
}));

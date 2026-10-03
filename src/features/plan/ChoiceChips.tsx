import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

export type Choice = {
  key: string;
  label: string;
  disabled?: boolean;
};

type ChoiceChipsProps = {
  choices: Choice[];
  selected: string | null;
  onSelect: (key: string) => void;
};

// A wrapping row of single-select options
export function ChoiceChips({ choices, selected, onSelect }: ChoiceChipsProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {choices.map(({ key, label, disabled }) => {
        const active = key === selected;
        return (
          <Pressable
            key={key}
            disabled={disabled}
            onPress={() => onSelect(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
          >
            <Text style={[typography.body, active && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  labelActive: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});

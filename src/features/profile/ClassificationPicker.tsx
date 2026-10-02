import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CLASSIFICATIONS, FARE_DISCOUNTED_CLASSES } from '@/shared/config';
import { useProfileStore } from '@/state/profileStore';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

import { CLASSIFICATION_LABELS } from './classificationLabels';

const ICON_SIZE = spacing.md + spacing.xs;

// The commuter picks their fare classification. It is stored on this device only (PRD 7.1).
export function ClassificationPicker() {
  const classification = useProfileStore((state) => state.classification);
  const setClassification = useProfileStore((state) => state.setClassification);

  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {CLASSIFICATIONS.map((option) => {
        const selected = option === classification;
        return (
          <Pressable
            key={option}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => setClassification(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <View style={styles.text}>
              <Text style={typography.body}>{CLASSIFICATION_LABELS[option]}</Text>
              <Text style={typography.caption}>
                {FARE_DISCOUNTED_CLASSES.includes(option) ? 'Discounted fare estimate' : 'Regular fare estimate'}
              </Text>
            </View>
            {selected ? <Check color={colors.cyan} size={ICON_SIZE} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  option: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.canvas,
    backgroundColor: colors.canvas,
  },
  optionSelected: {
    borderColor: colors.cyan,
  },
  text: {
    flex: 1,
  },
});

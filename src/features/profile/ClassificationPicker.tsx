import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { CLASSIFICATIONS, FARE_DISCOUNTED_CLASSES } from '@/shared/config';
import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;

// The commuter picks their fare classification. It is stored on this phone only (PRD 7.1).
export function ClassificationPicker() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
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
              <Text style={typography.body}>{strings.classification.labels[option]}</Text>
              <Text style={typography.caption}>
                {FARE_DISCOUNTED_CLASSES.includes(option)
                  ? strings.classification.discounted
                  : strings.classification.regular}
              </Text>
            </View>
            {selected ? <Check color={colors.primary} size={ICON_SIZE} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
    borderColor: colors.primary,
  },
  text: {
    flex: 1,
  },
}));

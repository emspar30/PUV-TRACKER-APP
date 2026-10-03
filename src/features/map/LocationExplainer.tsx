import { Pressable, StyleSheet, Text, View } from 'react-native';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

type LocationExplainerProps = {
  onContinue: () => void;
  onNotNow: () => void;
};

// Plain-language explanation shown before the system location prompt (PRD 4.2)
export function LocationExplainer({ onContinue, onNotNow }: LocationExplainerProps) {
  return (
    <View style={styles.card}>
      <Text style={typography.title} accessibilityRole="header">
        {strings.map.explainerTitle}
      </Text>
      <Text style={typography.body}>{strings.map.explainerBody}</Text>
      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.secondary]} onPress={onNotNow} accessibilityRole="button">
          <Text style={typography.body}>{strings.map.explainerNotNow}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.primary]} onPress={onContinue} accessibilityRole="button">
          <Text style={[typography.body, styles.primaryLabel]}>{strings.map.explainerContinue}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryLabel: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  secondary: {
    backgroundColor: colors.canvas,
  },
});

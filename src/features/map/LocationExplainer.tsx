import { Pressable, Text, View } from 'react-native';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

type LocationExplainerProps = {
  onContinue: () => void;
  onNotNow: () => void;
};

// Plain-language explanation shown before the system location prompt (PRD 4.2), on the first
// "Locate me" tap. From the partner's GPS work (b21b0c1), on our theme and strings.
// The G0 consent screen comes before it later; it is not part of the merge.
export function LocationExplainer({ onContinue, onNotNow }: LocationExplainerProps) {
  const styles = useStyles();
  const { typography } = useTheme();
  return (
    <View style={styles.card}>
      <Text style={typography.headlineSm} accessibilityRole="header">
        {strings.location.explainerTitle}
      </Text>
      <Text style={typography.bodyMd}>{strings.location.explainerBody}</Text>
      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.secondary]} onPress={onNotNow} accessibilityRole="button">
          <Text style={typography.labelLg}>{strings.location.notNow}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.primary]} onPress={onContinue} accessibilityRole="button">
          <Text style={[typography.labelLg, styles.primaryLabel]}>{strings.location.continue}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.sheet,
    ...elevation.level2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  button: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryLabel: {
    color: colors.onPrimary,
  },
  secondary: {
    backgroundColor: colors.surface,
  },
}));

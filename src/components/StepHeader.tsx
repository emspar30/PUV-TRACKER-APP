import { ArrowLeft } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

type StepHeaderProps = {
  title: string;
  onBack?: () => void;
  onSkip?: () => void;
  // The progress bar: step number (1-based), total steps and a short label on the right
  step?: { current: number; total: number; label: string };
};

const ICON_SIZE = spacing.lg;
const BAR_HEIGHT = spacing.xs;

// The top of a full-screen step (restyle): back, a title, Skip, then "STEP 2 OF 4" over a bar
export function StepHeader({ title, onBack, onSkip, step }: StepHeaderProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        {onBack ? (
          <Pressable style={styles.icon} onPress={onBack} accessibilityRole="button" accessibilityLabel={strings.common.back}>
            <ArrowLeft color={colors.textPrimary} size={ICON_SIZE} />
          </Pressable>
        ) : (
          <View style={styles.icon} />
        )}
        <Text style={[typography.headlineSm, styles.title]} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {onSkip ? (
          <Pressable style={styles.skip} onPress={onSkip} accessibilityRole="button">
            <Text style={[typography.labelLg, styles.skipText]}>{strings.common.skip}</Text>
          </Pressable>
        ) : (
          <View style={styles.icon} />
        )}
      </View>
      {step ? (
        <View style={styles.progress} accessibilityLabel={strings.onboarding.step(step.current, step.total)}>
          <View style={styles.progressLabels}>
            <Text style={typography.overline}>{strings.onboarding.step(step.current, step.total)}</Text>
            <Text style={typography.labelSm}>{step.label}</Text>
          </View>
          <View style={styles.segments}>
            {Array.from({ length: step.total }, (_, index) => (
              <View key={index} style={[styles.segment, index < step.current && styles.segmentOn]} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    gap: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  skip: {
    minWidth: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  skipText: {
    color: colors.primary,
  },
  progress: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  segments: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
  },
  segmentOn: {
    backgroundColor: colors.primary,
  },
}));

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Logo, Screen } from '@/components';
import { AvatarPicker } from '@/features/profile/AvatarPicker';
import { ClassificationPicker } from '@/features/profile/ClassificationPicker';
import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, radii, spacing, useTheme } from '@/theme';

const STEPS = 3;
const LOGO_SIZE = spacing.xl * 3;

// The introduction shown on first launch: welcome, about you, what stays on your phone.
// It can be skipped, and repeated from Profile. It never asks for a permission.
export default function OnboardingScreen() {
  const styles = useStyles();
  const { typography } = useTheme();
  const [step, setStep] = useState(0);
  const setOnboarded = useProfileStore((state) => state.setOnboarded);
  const isLast = step === STEPS - 1;

  const finish = () => {
    setOnboarded(true);
    // Opened from Profile there is a screen to go back to; on first launch there is not
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Screen
      title={
        step === 0
          ? strings.onboarding.welcomeTitle
          : step === 1
            ? strings.onboarding.aboutYouTitle
            : strings.onboarding.privacyTitle
      }
    >
      <Text style={typography.caption}>{strings.onboarding.step(step + 1, STEPS)}</Text>

      {step === 0 ? (
        <View style={styles.section}>
          <Logo size={LOGO_SIZE} />
          <Text style={typography.body}>{strings.onboarding.welcomeBody}</Text>
          <Text style={styles.amber}>{strings.onboarding.welcomeNote}</Text>
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.section}>
          <Text style={typography.body}>{strings.onboarding.aboutYouBody}</Text>
          <View style={styles.card}>
            <Text style={typography.body}>{strings.classification.title}</Text>
            <ClassificationPicker />
          </View>
          <View style={styles.card}>
            <Text style={typography.body}>{strings.avatar.title}</Text>
            <AvatarPicker />
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.section}>
          {strings.onboarding.privacyPoints.map((point) => (
            <View key={point} style={styles.point}>
              <View style={styles.bullet} />
              <Text style={[typography.body, styles.grow]}>{point}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={styles.primary}
          onPress={isLast ? finish : () => setStep(step + 1)}
          accessibilityRole="button"
        >
          <Text style={typography.body}>{isLast ? strings.onboarding.start : strings.common.next}</Text>
        </Pressable>
        <View style={styles.secondaryRow}>
          {step > 0 ? (
            <Pressable style={styles.secondary} onPress={() => setStep(step - 1)} accessibilityRole="button">
              <Text style={typography.body}>{strings.common.back}</Text>
            </Pressable>
          ) : null}
          {!isLast ? (
            <Pressable style={styles.secondary} onPress={finish} accessibilityRole="button">
              <Text style={typography.body}>{strings.common.skip}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  section: {
    gap: spacing.md,
  },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  amber: {
    ...typography.caption,
    color: colors.warning,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    width: spacing.sm,
    height: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: spacing.xs,
    backgroundColor: colors.primary,
  },
  grow: {
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primary: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondary: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
}));

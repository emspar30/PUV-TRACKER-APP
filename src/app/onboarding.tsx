import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components';
import { AvatarPicker } from '@/features/profile/AvatarPicker';
import { FareTypeChips } from '@/features/ride/FareTypeChips';
import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const LOGO_SIZE = spacing.xl * 2;
const ICON_SIZE = spacing.md;

// The first-launch introduction: one screen to choose a fare type and an avatar. Skippable, and
// repeatable from Settings. It never asks for a permission.
export default function OnboardingScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const setOnboarded = useProfileStore((state) => state.setOnboarded);

  const finish = () => {
    setOnboarded(true);
    // Opened from Settings there is a screen to go back to; on first launch there is not
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Logo size={LOGO_SIZE} />
          <Text style={typography.headlineLg} accessibilityRole="header">
            {strings.onboarding.title}
          </Text>
        </View>

        <Text style={typography.labelLg}>{strings.settings.fareType}</Text>
        <FareTypeChips />

        <Text style={typography.labelLg}>{strings.settings.avatar}</Text>
        <AvatarPicker />

        <View style={styles.note}>
          <Lock color={colors.textSecondary} size={ICON_SIZE} />
          <Text style={typography.bodySm}>{strings.onboarding.savedOnPhone}</Text>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={finish} accessibilityRole="button">
          <Text style={[typography.labelLg, styles.primaryText]}>{strings.onboarding.start}</Text>
        </Pressable>
        <Pressable style={styles.skip} onPress={finish} accessibilityRole="button">
          <Text style={typography.labelLg}>{strings.common.skip}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm + spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  actions: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  primary: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: colors.onPrimary,
  },
  skip: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

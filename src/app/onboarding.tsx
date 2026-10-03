import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, Logo } from '@/components';
import { LANDMARKS } from '@/data/seed/landmarks.placeholder';
import { Avatar } from '@/features/profile/Avatar';
import { FareTypeChips } from '@/features/ride/FareTypeChips';
import { FREQUENT_DESTINATIONS_MAX } from '@/shared/config';
import { GENDERS } from '@/shared/profile/avatarPick';
import { useDestinationsStore } from '@/state/destinationsStore';
import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const LOGO_SIZE = spacing.xl * 2;
const AVATAR_SIZE = spacing.xl * 3;
const ICON_SIZE = spacing.md;

const STEPS = ['welcome', 'gender', 'type', 'places'] as const;
type Step = (typeof STEPS)[number];

// The introduction (PRD 19, D3): a welcome from Tunton, an optional gender question that picks the
// avatar, the commuter type, and up to three frequent destinations. Every answer stays on the
// phone. Skip works on every step; it can be replayed from Settings. It never asks for a permission.
export default function OnboardingScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('welcome');

  const gender = useProfileStore((state) => state.gender);
  const avatarId = useProfileStore((state) => state.avatarId);
  const avatarAssigned = useProfileStore((state) => state.avatarAssigned);
  const setGender = useProfileStore((state) => state.setGender);
  const assignAvatar = useProfileStore((state) => state.assignAvatar);
  const setOnboarded = useProfileStore((state) => state.setOnboarded);
  const destinations = useDestinationsStore((state) => state.destinations);
  const addDestination = useDestinationsStore((state) => state.add);
  const removeDestination = useDestinationsStore((state) => state.remove);

  const index = STEPS.indexOf(step);
  const isLast = index === STEPS.length - 1;

  const finish = () => {
    // Skipping still gives an avatar, from all twelve when there is no answer
    assignAvatar();
    setOnboarded(true);
    // Opened from Settings there is a screen to go back to; on first launch there is not
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const next = () => (isLast ? finish() : setStep(STEPS[index + 1]));

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.bodySm}>{strings.onboarding.step(index + 1, STEPS.length)}</Text>

        {step === 'welcome' ? (
          <View style={styles.section}>
            <Logo size={LOGO_SIZE} />
            <Text style={typography.headlineLg} accessibilityRole="header">
              {strings.onboarding.welcomeTitle}
            </Text>
            <Text style={typography.bodyLg}>{strings.onboarding.welcomeBody}</Text>
          </View>
        ) : null}

        {step === 'gender' ? (
          <View style={styles.section}>
            <Text style={typography.headlineLg} accessibilityRole="header">
              {strings.onboarding.genderTitle}
            </Text>
            <Text style={typography.bodyMd}>{strings.onboarding.genderHint}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {GENDERS.map((option) => (
                <Chip
                  key={option}
                  label={strings.onboarding.genders[option]}
                  selected={gender === option}
                  onPress={() => {
                    setGender(option);
                    // Only the first answer picks; later changes keep the avatar (D3)
                    assignAvatar();
                  }}
                />
              ))}
            </View>
            {avatarAssigned ? (
              <View style={styles.avatarRow}>
                <Avatar id={avatarId} size={AVATAR_SIZE} />
                <View style={styles.grow}>
                  <Text style={typography.labelLg}>{strings.onboarding.yourAvatar}</Text>
                  <Text style={typography.bodySm}>{strings.onboarding.shuffleLater}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 'type' ? (
          <View style={styles.section}>
            <Text style={typography.headlineLg} accessibilityRole="header">
              {strings.onboarding.typeTitle}
            </Text>
            <Text style={typography.bodyMd}>{strings.onboarding.typeHint}</Text>
            <FareTypeChips />
          </View>
        ) : null}

        {step === 'places' ? (
          <View style={styles.section}>
            <Text style={typography.headlineLg} accessibilityRole="header">
              {strings.onboarding.placesTitle}
            </Text>
            <Text style={typography.bodyMd}>{strings.onboarding.placesHint(FREQUENT_DESTINATIONS_MAX)}</Text>
            <View style={styles.chips}>
              {LANDMARKS.map((landmark) => {
                const selected = destinations.some((item) => item.id === landmark.id);
                return (
                  <Chip
                    key={landmark.id}
                    label={landmark.label}
                    selected={selected}
                    accessibilityLabel={strings.onboarding.placeLabel(`${landmark.label}, ${landmark.name}`)}
                    onPress={() =>
                      selected
                        ? removeDestination(landmark.id)
                        : addDestination({ id: landmark.id, label: landmark.label, lat: landmark.lat, lon: landmark.lon })
                    }
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {step !== 'welcome' ? (
          <View style={styles.note}>
            <Lock color={colors.textSecondary} size={ICON_SIZE} />
            <Text style={typography.bodySm}>{strings.onboarding.savedOnPhone}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={next} accessibilityRole="button">
          <Text style={[typography.labelLg, styles.primaryText]}>
            {isLast ? strings.onboarding.start : strings.onboarding.next}
          </Text>
        </Pressable>
        {!isLast ? (
          <Pressable style={styles.skip} onPress={finish} accessibilityRole="button">
            <Text style={typography.labelLg}>{strings.common.skip}</Text>
          </Pressable>
        ) : null}
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
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm + spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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

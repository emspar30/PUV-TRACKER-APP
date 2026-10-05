import { router } from 'expo-router';
import {
  Accessibility,
  ArrowRight,
  BellRing,
  GraduationCap,
  HeartHandshake,
  Lock,
  Mail,
  MapPin,
  Navigation,
  Radar,
  Search,
  ShieldCheck,
  User,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Logo, OptionRow, StepHeader } from '@/components';
import { LANDMARKS } from '@/data/seed/landmarks.placeholder';
import { Avatar } from '@/features/profile/Avatar';
import { isValidUsername } from '@/shared/backend/rules';
import {
  CLASSIFICATIONS,
  FARE_DISCOUNT_MULTIPLIER,
  FARE_DISCOUNTED_CLASSES,
  FREQUENT_DESTINATIONS_MAX,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type Classification,
} from '@/shared/config';
import { avatarSetFor } from '@/shared/profile/avatarPick';
import { useDestinationsStore } from '@/state/destinationsStore';
import { useFareType } from '@/state/fareType';
import { useProfileStore } from '@/state/profileStore';
import { useSessionStore } from '@/state/sessionStore';
import { useUsernameStore } from '@/state/usernameStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const HERO_SIZE = spacing.xl * 3;
const PREVIEW_SIZE = spacing.xl * 3;
const GRID_AVATAR = MIN_TOUCH_TARGET;
const ICON_SIZE = spacing.md;
const PERCENT = 100;
const DISCOUNT_PERCENT = Math.round((1 - FARE_DISCOUNT_MULTIPLIER) * PERCENT);

const STEPS = ['welcome', 'profile', 'type', 'places', 'permissions'] as const;
type Step = (typeof STEPS)[number];
// The welcome is not counted; the bar shows the four set-up steps
const COUNTED = STEPS.length - 1;

const TYPE_ICONS: Record<Classification, LucideIcon> = {
  regular: User,
  student: GraduationCap,
  senior: HeartHandshake,
  pwd: Accessibility,
};

// The introduction (PRD 19, D3, D4, D7; restyle 2026-10-05): a welcome with sign-in, an avatar and
// handle, the commuter type, frequent places, and what the app will ask for later. Every answer but
// the handle stays on the phone; the handle is sent when the user signs in. Skip works on every step,
// and it can be replayed from Settings. It never asks for a permission itself.
export default function OnboardingScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('welcome');

  const assignAvatar = useProfileStore((state) => state.assignAvatar);
  const setOnboarded = useProfileStore((state) => state.setOnboarded);
  const savedUsername = useUsernameStore((state) => state.username);
  const setUsername = useUsernameStore((state) => state.setUsername);
  const [handle, setHandle] = useState(savedUsername ?? '');

  const index = STEPS.indexOf(step);
  const handleValid = handle.length === 0 || isValidUsername(handle);

  const saveHandle = () => {
    if (handle.length > 0 && isValidUsername(handle) && handle !== savedUsername) setUsername(handle);
  };

  const finish = () => {
    saveHandle();
    // Skipping still gives an avatar, from all twelve when there is no answer
    assignAvatar();
    setOnboarded(true);
    // Opened from Settings there is a screen to go back to; on first launch there is not
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const next = () => (index === STEPS.length - 1 ? finish() : setStep(STEPS[index + 1]));
  const back = () => setStep(STEPS[Math.max(0, index - 1)]);

  if (step === 'welcome') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom }]}>
        <Welcome
          onSignIn={() => {
            setStep('profile');
            router.push('/sign-in');
          }}
          onContinue={next}
        />
      </View>
    );
  }

  const titles: Record<Exclude<Step, 'welcome'>, string> = {
    profile: strings.onboarding.profileStep,
    type: strings.onboarding.typeStep,
    places: strings.onboarding.placesStep,
    permissions: strings.onboarding.permissionsStep,
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StepHeader
        title={titles[step]}
        onBack={back}
        onSkip={finish}
        step={{ current: index, total: COUNTED, label: titles[step] }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'profile' ? <ProfileStep handle={handle} onHandle={setHandle} valid={handleValid} /> : null}
        {step === 'type' ? <TypeStep /> : null}
        {step === 'places' ? <PlacesStep /> : null}
        {step === 'permissions' ? <PermissionsStep /> : null}
      </ScrollView>
      <View style={styles.actions}>
        <Button
          label={index === STEPS.length - 1 ? strings.onboarding.finish : strings.onboarding.next}
          icon={ArrowRight}
          onPress={() => {
            if (step === 'profile') saveHandle();
            next();
          }}
          disabled={step === 'profile' && !handleValid}
        />
      </View>
    </View>
  );
}

function Welcome({ onSignIn, onContinue }: { onSignIn: () => void; onContinue: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  // Sign-in is offered only when the app has the Supabase values and no one is signed in yet
  const status = useSessionStore((state) => state.status);
  const canSignIn = status === 'signed-out' || status === 'loading';
  const features: { icon: LucideIcon; tone: 'primary' | 'warning' | 'success'; text: string }[] = [
    { icon: Radar, tone: 'primary', text: strings.onboarding.features.live },
    { icon: WifiOff, tone: 'warning', text: strings.onboarding.features.offline },
    { icon: ShieldCheck, tone: 'success', text: strings.onboarding.features.privacy },
  ];
  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.hero}>
          <Logo size={HERO_SIZE} />
          <Text style={[typography.headlineMd, styles.center]} accessibilityRole="header">
            {strings.onboarding.welcomeTitle}
          </Text>
          <Text style={[typography.bodyMd, styles.center, styles.muted]}>{strings.onboarding.welcomeBody}</Text>
        </Card>
        {features.map((feature) => (
          <OptionRow key={feature.text} icon={feature.icon} tone={feature.tone} title={feature.text} />
        ))}
      </ScrollView>
      <View style={styles.actions}>
        {canSignIn ? <Button label={strings.onboarding.signIn} leadingIcon={Mail} onPress={onSignIn} /> : null}
        <Button
          label={strings.onboarding.withoutAccount}
          variant={canSignIn ? 'secondary' : 'primary'}
          icon={canSignIn ? undefined : ArrowRight}
          onPress={onContinue}
        />
        <View style={styles.note}>
          <Lock color={colors.textSecondary} size={ICON_SIZE} />
          <Text style={typography.bodySm}>{strings.onboarding.welcomeNote}</Text>
        </View>
      </View>
    </>
  );
}

function StepIntro({ title, body }: { title: string; body: string }) {
  const { typography } = useTheme();
  return (
    <View>
      <Text style={typography.headlineLg} accessibilityRole="header">
        {title}
      </Text>
      <Text style={typography.bodyMd}>{body}</Text>
    </View>
  );
}

function ProfileStep({ handle, onHandle, valid }: { handle: string; onHandle: (text: string) => void; valid: boolean }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const avatarId = useProfileStore((state) => state.avatarId);
  const setAvatarId = useProfileStore((state) => state.setAvatarId);
  const gender = useProfileStore((state) => state.gender);
  const avatars = avatarSetFor(gender);
  return (
    <>
      <StepIntro title={strings.onboarding.profileTitle} body={strings.onboarding.profileBody} />
      <View style={styles.preview}>
        <Avatar id={avatarId} size={PREVIEW_SIZE} />
      </View>
      <View style={styles.groupLabel}>
        <Text style={typography.overline}>{strings.onboarding.persona}</Text>
        <Text style={typography.labelSm}>{strings.onboarding.personaCount(avatars.length)}</Text>
      </View>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {avatars.map((id) => {
          const selected = id === avatarId;
          return (
            <Pressable
              key={id}
              style={[styles.gridCell, selected && styles.gridCellOn]}
              onPress={() => setAvatarId(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={strings.avatar.option(id + 1)}
            >
              <Avatar id={id} size={GRID_AVATAR} />
            </Pressable>
          );
        })}
      </View>
      <Text style={typography.overline}>{strings.onboarding.handle}</Text>
      <View style={[styles.input, !valid && styles.inputError]}>
        <Text style={[typography.bodyLg, styles.muted]}>@</Text>
        <TextInput
          style={[typography.bodyLg, styles.inputText]}
          value={handle}
          onChangeText={(text) => onHandle(text.trim())}
          placeholder={strings.onboarding.handlePlaceholder}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={USERNAME_MAX_LENGTH}
          accessibilityLabel={strings.onboarding.handle}
        />
      </View>
      <Text style={[typography.bodySm, !valid && styles.error]}>
        {valid
          ? strings.onboarding.handleHint(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
          : strings.onboarding.handleInvalid(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)}
      </Text>
    </>
  );
}

function TypeStep() {
  const styles = useStyles();
  const [fareType, setFareType] = useFareType();
  return (
    <>
      <StepIntro title={strings.onboarding.typeTitle} body={strings.onboarding.typeBody} />
      <View style={styles.list} accessibilityRole="radiogroup">
        {CLASSIFICATIONS.map((option) => (
          <OptionRow
            key={option}
            icon={TYPE_ICONS[option]}
            title={strings.classification.labels[option]}
            subtitle={strings.onboarding.typeSubtitles[option]}
            badge={FARE_DISCOUNTED_CLASSES.includes(option) ? strings.onboarding.discount(DISCOUNT_PERCENT) : undefined}
            selected={option === fareType}
            onPress={() => setFareType(option)}
          />
        ))}
      </View>
      <SavedOnPhone />
    </>
  );
}

function PlacesStep() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const [query, setQuery] = useState('');
  const destinations = useDestinationsStore((state) => state.destinations);
  const add = useDestinationsStore((state) => state.add);
  const remove = useDestinationsStore((state) => state.remove);
  const needle = query.trim().toLowerCase();
  const matches = LANDMARKS.filter((landmark) => `${landmark.label} ${landmark.name}`.toLowerCase().includes(needle));
  return (
    <>
      <StepIntro title={strings.onboarding.placesTitle} body={strings.onboarding.placesBody(FREQUENT_DESTINATIONS_MAX)} />
      <View style={styles.input}>
        <Search color={colors.textSecondary} size={ICON_SIZE} />
        <TextInput
          style={[typography.bodyLg, styles.inputText]}
          value={query}
          onChangeText={setQuery}
          placeholder={strings.onboarding.placesSearch}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={strings.onboarding.placesSearch}
        />
      </View>
      <View style={styles.list}>
        {matches.map((landmark) => {
          const selected = destinations.some((item) => item.id === landmark.id);
          return (
            <OptionRow
              key={landmark.id}
              icon={MapPin}
              title={landmark.label}
              subtitle={landmark.name}
              multiple
              selected={selected}
              accessibilityLabel={strings.onboarding.placeLabel(`${landmark.label}, ${landmark.name}`)}
              onPress={() =>
                selected ? remove(landmark.id) : add({ id: landmark.id, label: landmark.label, lat: landmark.lat, lon: landmark.lon })
              }
            />
          );
        })}
        {matches.length === 0 ? <Text style={typography.bodySm}>{strings.onboarding.placesNone}</Text> : null}
      </View>
      <SavedOnPhone />
    </>
  );
}

function PermissionsStep() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const rows: { key: keyof typeof strings.onboarding.permissions; icon: LucideIcon; tone: 'primary' | 'success' | 'warning' }[] = [
    { key: 'location', icon: Navigation, tone: 'primary' },
    { key: 'nearby', icon: Radar, tone: 'success' },
    { key: 'alerts', icon: BellRing, tone: 'warning' },
  ];
  return (
    <>
      <StepIntro title={strings.onboarding.permissionsTitle} body={strings.onboarding.permissionsBody} />
      <View style={styles.list}>
        {rows.map(({ key, icon, tone }) => {
          const text = strings.onboarding.permissions[key];
          return (
            <OptionRow
              key={key}
              icon={icon}
              tone={tone}
              title={text.title}
              subtitle={text.body}
              trailing={
                <View style={styles.status}>
                  <Text style={[typography.labelSm, styles.statusText]}>{text.status}</Text>
                </View>
              }
            />
          );
        })}
      </View>
      <View style={styles.note}>
        <Lock color={colors.textSecondary} size={ICON_SIZE} />
        <Text style={typography.bodySm}>{strings.onboarding.permissionsNote}</Text>
      </View>
    </>
  );
}

function SavedOnPhone() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={styles.note}>
      <Lock color={colors.textSecondary} size={ICON_SIZE} />
      <Text style={typography.bodySm}>{strings.onboarding.savedOnPhone}</Text>
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
  hero: {
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingVertical: spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
  muted: {
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  preview: {
    alignItems: 'center',
  },
  groupLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCell: {
    padding: spacing.xs,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  gridCellOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  input: {
    minHeight: MIN_TOUCH_TARGET + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputText: {
    flex: 1,
  },
  error: {
    color: colors.danger,
  },
  list: {
    gap: spacing.sm,
  },
  status: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  statusText: {
    color: colors.textSecondary,
  },
}));

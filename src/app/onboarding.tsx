import { router } from 'expo-router';
import {
  Accessibility,
  ArrowRight,
  BellRing,
  ChevronDown,
  ChevronUp,
  Dices,
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
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Button, Card, LineBadge, Logo, OptionRow, StepHeader } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { LANDMARKS } from '@/data/seed/landmarks.placeholder';
import { useLocationPermission } from '@/features/map/useCommuterPosition';
import { Avatar } from '@/features/profile/Avatar';
import { ShuffleAvatarChip } from '@/features/profile/AvatarPicker';
import { isValidUsername, usernameIssue } from '@/shared/backend/rules';
import {
  CLASSIFICATIONS,
  FARE_DISCOUNT_MULTIPLIER,
  FARE_DISCOUNTED_CLASSES,
  FREQUENT_DESTINATIONS_MAX,
  ONBOARDING_PLACES_PREVIEW,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type Classification,
} from '@/shared/config';
import { avatarSetFor } from '@/shared/profile/avatarPick';
import { suggestUsername } from '@/shared/profile/usernameSuggest';
import { routesNear } from '@/shared/routing/suggest';
import { compareRouteCodes } from '@/shared/ui/routeVisibility';
import { useDestinationsStore } from '@/state/destinationsStore';
import { useFareType } from '@/state/fareType';
import { useProfileStore } from '@/state/profileStore';
import { useSessionStore } from '@/state/sessionStore';
import { useUsernameStore } from '@/state/usernameStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const HERO_SIZE = spacing.xl * 3;
// ST2-B: the avatar swipe row. Every cell is as wide as the chosen avatar, which sits in the middle,
// larger and in full colour; the others are smaller and faded, and both edges fade into the page.
const SLIDE_CELL = spacing.xl * 2 + spacing.md;
const SLIDE_AVATAR = spacing.xl * 2 - spacing.sm;
const SLIDE_RING = 2;
const SLIDE_GAP = spacing.sm;
const SLIDE_STEP = SLIDE_CELL + SLIDE_GAP;
const SLIDE_FADED = 0.5;
const SLIDE_FADE_WIDTH = spacing.xl + spacing.md;
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
// username, the commuter type, frequent places, and what the app will ask for later. Every answer but
// the handle stays on the phone; the handle is sent when the user signs in. AU1: the welcome moves on
// only once someone is signed in; Skip works on every later step, and it can be replayed from
// Settings. It never asks for a permission itself.
export default function OnboardingScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('welcome');

  const assignAvatar = useProfileStore((state) => state.assignAvatar);
  const setOnboarded = useProfileStore((state) => state.setOnboarded);
  const savedUsername = useUsernameStore((state) => state.username);
  const setUsername = useUsernameStore((state) => state.setUsername);
  // ST2-B: never empty; without a saved username a suggested one is filled in, ready to edit
  const [handle, setHandle] = useState(() => savedUsername ?? suggestUsername(Math.random));

  const index = STEPS.indexOf(step);

  // ST2-A: sign-in opens over the welcome, which moves on only once someone is signed in; Back from
  // sign-in returns to the welcome
  const signingIn = useRef(false);
  useEffect(
    () =>
      useSessionStore.subscribe((state) => {
        if (signingIn.current && state.status === 'signed-in') {
          signingIn.current = false;
          setStep('profile');
        }
      }),
    [],
  );
  const handleValid = isValidUsername(handle);

  const saveHandle = () => {
    if (handleValid && handle !== savedUsername) setUsername(handle);
  };

  const finish = () => {
    saveHandle();
    // Skipping still gives an avatar, from all of them when there is no answer
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
            signingIn.current = true;
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
        step={{ current: index, total: COUNTED }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'profile' ? (
          <ProfileStep handle={handle} onHandle={setHandle} onSuggest={() => setHandle(suggestUsername(Math.random))} valid={handleValid} />
        ) : null}
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
  // AU1: an account is needed, so there is no way on without one. Continue is offered only when
  // someone is already signed in (the introduction replayed) or the build has no backend (development)
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
        {canSignIn ? (
          <Button label={strings.onboarding.signIn} leadingIcon={Mail} onPress={onSignIn} />
        ) : (
          <Button label={strings.onboarding.continue} icon={ArrowRight} onPress={onContinue} />
        )}
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

function ProfileStep({
  handle,
  onHandle,
  onSuggest,
  valid,
}: {
  handle: string;
  onHandle: (text: string) => void;
  onSuggest: () => void;
  valid: boolean;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const avatarId = useProfileStore((state) => state.avatarId);
  const setAvatarId = useProfileStore((state) => state.setAvatarId);
  const gender = useProfileStore((state) => state.gender);
  const avatars = avatarSetFor(gender);
  // ST2-B: the chosen avatar is kept in the middle, also after Shuffle; a swipe chooses the one that
  // stops in the middle
  const row = useRef<ScrollView>(null);
  const [rowWidth, setRowWidth] = useState(0);
  const selectedIndex = avatars.indexOf(avatarId ?? -1);
  useEffect(() => {
    if (rowWidth > 0 && selectedIndex >= 0) row.current?.scrollTo({ x: selectedIndex * SLIDE_STEP, animated: true });
  }, [selectedIndex, rowWidth]);
  const side = Math.max(0, (rowWidth - SLIDE_CELL) / 2);
  return (
    <>
      <StepIntro title={strings.onboarding.profileTitle} body={strings.onboarding.profileBody} />
      <View style={styles.groupLabel}>
        <Text style={typography.overline}>{strings.onboarding.persona}</Text>
        {/* B7: Shuffle lives here only */}
        <ShuffleAvatarChip />
      </View>
      <View style={styles.slideRow} onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
        <ScrollView
          ref={row}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SLIDE_STEP}
          decelerationRate="fast"
          contentContainerStyle={[styles.slides, { paddingHorizontal: side }]}
          onMomentumScrollEnd={(event) => {
            const at = Math.round(event.nativeEvent.contentOffset.x / SLIDE_STEP);
            const id = avatars[Math.min(Math.max(at, 0), avatars.length - 1)];
            if (id !== avatarId) setAvatarId(id);
          }}
          accessibilityRole="radiogroup"
          accessibilityHint={strings.onboarding.swipeAvatars}
        >
          {avatars.map((id) => {
            const selected = id === avatarId;
            return (
              <Pressable
                key={id}
                style={styles.slide}
                onPress={() => setAvatarId(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={strings.avatar.option(id + 1)}
              >
                <View style={[styles.ring, selected ? styles.ringOn : styles.faded]}>
                  <Avatar id={id} size={selected ? SLIDE_CELL - SLIDE_RING * 4 : SLIDE_AVATAR} />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <EdgeFade side="left" color={colors.canvas} />
        <EdgeFade side="right" color={colors.canvas} />
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
        <Pressable style={styles.suggest} onPress={onSuggest} accessibilityRole="button" accessibilityLabel={strings.onboarding.suggestUsername}>
          <Dices color={colors.primary} size={ICON_SIZE + spacing.xs} />
        </Pressable>
      </View>
      <Text style={[typography.bodySm, !valid && styles.error]}>
        {valid
          ? strings.onboarding.handleHint(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
          : usernameIssue(handle) === 'blocked'
            ? strings.onboarding.handleBlocked
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
    </>
  );
}

function PlacesStep() {
  const styles = useStyles();
  const { colors, typography, routeColor } = useTheme();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const destinations = useDestinationsStore((state) => state.destinations);
  const add = useDestinationsStore((state) => state.add);
  const remove = useDestinationsStore((state) => state.remove);
  const needle = query.trim().toLowerCase();
  const matches = LANDMARKS.filter((landmark) => `${landmark.label} ${landmark.name}`.toLowerCase().includes(needle));
  const { lines } = useRouteData();
  // ST2-B: the first few places, and any already picked; the rest behind Show more
  const isPicked = (id: string) => destinations.some((item) => item.id === id);
  const shown = expanded ? matches : matches.filter((landmark, at) => at < ONBOARDING_PLACES_PREVIEW || isPicked(landmark.id));
  const hidden = matches.length - shown.length;
  const colorOf = (code: string) => routeColor(code, lines.find((line) => line.routeCode === code)?.color ?? colors.primary);
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
        {shown.map((landmark) => {
          const selected = isPicked(landmark.id);
          const codes = routesNear(lines, landmark)
            .map((item) => item.routeCode)
            .sort(compareRouteCodes);
          return (
            <OptionRow
              key={landmark.id}
              icon={MapPin}
              title={landmark.name}
              subtitle={landmark.label}
              below={
                codes.length > 0 ? (
                  <View style={styles.badges}>
                    {codes.map((code) => (
                      <LineBadge key={code} code={code} color={colorOf(code)} small />
                    ))}
                  </View>
                ) : undefined
              }
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
        {matches.length > ONBOARDING_PLACES_PREVIEW && (expanded || hidden > 0) ? (
          <Pressable style={styles.more} onPress={() => setExpanded(!expanded)} accessibilityRole="button">
            <Text style={[typography.labelLg, styles.moreText]}>
              {expanded ? strings.onboarding.showFewerPlaces : strings.onboarding.showMorePlaces(hidden)}
            </Text>
            {expanded ? <ChevronUp color={colors.primary} size={ICON_SIZE} /> : <ChevronDown color={colors.primary} size={ICON_SIZE} />}
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

function PermissionsStep() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const location = useLocationPermission();
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
                key === 'location' ? (
                  location.blocked ? (
                    <Pressable style={styles.status} onPress={location.request} accessibilityRole="button">
                      <Text style={[typography.labelSm, styles.statusText]}>{strings.onboarding.permissions.location.blocked}</Text>
                    </Pressable>
                  ) : (
                    <Switch
                      value={location.granted}
                      onValueChange={() => (location.granted ? undefined : location.request())}
                      disabled={location.granted}
                      trackColor={{ false: colors.surfaceHigh, true: colors.primary }}
                      thumbColor={colors.card}
                      accessibilityLabel={text.title}
                    />
                  )
                ) : (
                  <View style={styles.status}>
                    <Text style={[typography.labelSm, styles.statusText]}>{text.status}</Text>
                  </View>
                )
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

// A strip over one end of the avatar row that fades from the page colour to clear
function EdgeFade({ side, color }: { side: 'left' | 'right'; color: string }) {
  const styles = useStyles();
  const id = `fade-${side}`;
  return (
    <View pointerEvents="none" style={[styles.fade, side === 'left' ? styles.fadeLeft : styles.fadeRight]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1={side === 'left' ? '0' : '1'} y1="0" x2={side === 'left' ? '1' : '0'} y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
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
  groupLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Edge to edge, past the page padding, so the row reads as swipeable
  slideRow: {
    marginHorizontal: -spacing.md,
  },
  slides: {
    gap: SLIDE_GAP,
    alignItems: 'center',
  },
  slide: {
    width: SLIDE_CELL,
    height: SLIDE_CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    padding: SLIDE_RING,
    borderRadius: SLIDE_CELL / 2,
    borderWidth: SLIDE_RING,
    borderColor: 'transparent',
  },
  ringOn: {
    borderColor: colors.primary,
  },
  faded: {
    opacity: SLIDE_FADED,
  },
  fade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SLIDE_FADE_WIDTH,
  },
  fadeLeft: {
    left: 0,
  },
  fadeRight: {
    right: 0,
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
  suggest: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  more: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  moreText: {
    color: colors.primary,
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

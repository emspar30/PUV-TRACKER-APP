import { router } from 'expo-router';
import { Bus, Check, ChevronDown, ChevronUp, Pencil, ShieldCheck, X, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button, Card, IconTile, Screen, SkeletonCard, SkeletonHero } from '@/components';
import { useRefillCountdown } from '@/features/energy/useRefillCountdown';
import { useSkeleton } from '@/features/loading/useSkeleton';
import { AvatarPicker } from '@/features/profile/AvatarPicker';
import { BadgesCard } from '@/features/profile/BadgesCard';
import { FareTypeDropdown } from '@/features/profile/FareTypeDropdown';
import { PlacesCard } from '@/features/profile/PlacesCard';
import { TrustedAvatar } from '@/features/profile/TrustedAvatar';
import { usernameIssue } from '@/shared/backend/rules';
import {
  ENERGY_PASSIVE_INTERVAL_H,
  ENERGY_UI_VISIBLE,
  ENERGY_WALLET_CAP,
  SKELETON_LONG_MS,
  TRUST_BADGE_POINTS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '@/shared/config';
import { generalHistory } from '@/shared/profile/history';
import { isTrusted } from '@/shared/profile/trust';
import { showDialog } from '@/state/dialogStore';
import { useEnergyStore } from '@/state/energyStore';
import { useHistoryStore } from '@/state/historyStore';
import { useProfileStore } from '@/state/profileStore';
import { useRidesStore } from '@/state/ridesStore';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import { refreshTrust, useTrustPoints } from '@/state/trustStore';
import { syncUsername, useUsernameStore } from '@/state/usernameStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const AVATAR_SIZE = spacing.xl * 3;
const ICON_SIZE = spacing.md + spacing.xs;
// Small icon buttons with a 48 dp touch target
const ICON_BUTTON = spacing.xl;
const ICON_HIT_SLOP = (MIN_TOUCH_TARGET - ICON_BUTTON) / 2;
const BAR_HEIGHT = spacing.sm;
const PERCENT = 100;

// Profile (restyle, B7), opened from the menu or the avatar: the avatar (a tap opens the avatar
// choices), the handle with a pencil to edit it, the trust progress, a compact fare type dropdown,
// then Tracking Energy (hidden while tracking is free, D1) and ride counts. Everything but the handle
// stays on this phone; the handle is sent when the user signs in, and saved to the account at once
// while signed in (SB2).
export default function ProfileScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const avatarId = useProfileStore((state) => state.avatarId);
  const username = useUsernameStore((state) => state.username);
  const setUsername = useUsernameStore((state) => state.setUsername);
  const synced = useUsernameStore((state) => state.synced);
  const syncError = useUsernameStore((state) => state.syncError);
  const signedIn = useSessionStore((state) => state.status === 'signed-in');
  const energy = useEnergyStore((state) => state.snapshot);
  const energySource = useEnergyStore((state) => state.source);
  const refillIn = useRefillCountdown();
  const rides = useRidesStore((state) => state.rides);
  const demo = useSettingsStore((state) => state.demoData);
  const trustPoints = useTrustPoints();
  const [picking, setPicking] = useState(false);
  // B8: a skeleton while the page first opens (the wallet and trust points come over the network)
  const loading = useSkeleton(SKELETON_LONG_MS);
  const [historyOpen, setHistoryOpen] = useState(false);
  const clearedAtMs = useHistoryStore((state) => state.clearedAtMs);
  const clearHistory = useHistoryStore((state) => state.clear);
  const [editing, setEditing] = useState(false);
  const [handle, setHandle] = useState(username ?? '');
  const issue = handle.length === 0 ? null : usernameIssue(handle);
  const valid = issue === null;

  // Live trust points can change on the server (a flag takes one back): read them when Profile opens
  useEffect(() => {
    if (!demo) void refreshTrust();
  }, [demo]);

  const startEditing = () => {
    setHandle(username ?? '');
    setEditing(true);
  };
  const save = () => {
    if (handle.length === 0 || !valid) return;
    if (handle !== username) {
      setUsername(handle);
      if (signedIn) void syncUsername();
    }
    setEditing(false);
  };

  const handleMessage = (() => {
    if (issue === 'format') return strings.onboarding.handleInvalid(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH);
    if (issue === 'blocked') return strings.onboarding.handleBlocked;
    if (handle === username && syncError === 'taken') return strings.profilePage.handleTaken;
    if (handle === username && syncError) return strings.profilePage.handleSaveFailed;
    if (signedIn && username && !synced) return strings.profilePage.handleNotSaved;
    return strings.onboarding.handleHint(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH);
  })();
  const handleError = !valid || (handle === username && syncError !== null);
  // Out of editing, only a problem with the saved handle is worth a line
  const savedProblem = !editing && username && (syncError !== null || (signedIn && !synced)) ? handleMessage : null;

  // Signed out on live data: there is no wallet until there is an account
  const energyNeedsSignIn = !energy && energySource === 'live';
  const energySubtitle = energy
    ? [
        ...(refillIn ? [strings.profilePage.energyRefill(refillIn)] : []),
        ...(energy.nextRefillMs === null ? [strings.profilePage.energyFull] : []),
        ...(energy.enabled ? [] : [strings.profilePage.energyFree]),
      ].join(' · ')
    : energyNeedsSignIn
      ? strings.profilePage.energySignIn
      : strings.profilePage.energyFree;

  // D1: while Energy is hidden, the history shows rides only
  const history = generalHistory(ENERGY_UI_VISIBLE ? (energy?.history ?? []) : [], rides, clearedAtMs);
  const energyShare = energy ? Math.min(Math.max(energy.balance / ENERGY_WALLET_CAP, 0), 1) : 0;
  const confirmClear = () =>
    showDialog({
      tone: 'warning',
      title: strings.profilePage.clearTitle,
      body: ENERGY_UI_VISIBLE ? strings.profilePage.clearBody : strings.profilePage.clearBodyNoEnergy,
      actions: [
        { label: strings.profilePage.clearConfirm, variant: 'danger', onPress: () => clearHistory(Date.now()) },
        { label: strings.common.close, variant: 'secondary' },
      ],
    });

  if (loading) {
    return (
      <Screen title={strings.profilePage.title}>
        <SkeletonHero />
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  return (
    <Screen title={strings.profilePage.title}>
      <Card style={styles.hero}>
        {/* B7: the avatar choices stay hidden until the avatar is tapped */}
        <Pressable
          onPress={() => setPicking((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: picking }}
          accessibilityLabel={strings.profilePage.changeAvatar}
        >
          <TrustedAvatar id={avatarId} size={AVATAR_SIZE} />
        </Pressable>
        {picking ? (
          <>
            <Text style={typography.bodySm}>{strings.profilePage.pickAvatar}</Text>
            <AvatarPicker onPick={() => setPicking(false)} />
          </>
        ) : null}

        {editing ? (
          <>
            <View style={styles.editRow}>
              <View style={[styles.input, handleError && styles.inputError]}>
                <Text style={[typography.bodyLg, styles.muted]}>@</Text>
                <TextInput
                  style={[typography.bodyLg, styles.grow]}
                  value={handle}
                  onChangeText={(text) => setHandle(text.trim())}
                  onSubmitEditing={save}
                  placeholder={strings.onboarding.handlePlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  maxLength={USERNAME_MAX_LENGTH}
                  accessibilityLabel={strings.profilePage.handle}
                />
              </View>
              <Pressable
                style={styles.iconButton}
                hitSlop={ICON_HIT_SLOP}
                onPress={save}
                disabled={handle.length === 0 || !valid}
                accessibilityRole="button"
                accessibilityLabel={strings.profilePage.saveHandle}
              >
                <Check color={handle.length === 0 || !valid ? colors.textTertiary : colors.primary} size={ICON_SIZE} />
              </Pressable>
              <Pressable
                style={styles.iconButton}
                hitSlop={ICON_HIT_SLOP}
                onPress={() => setEditing(false)}
                accessibilityRole="button"
                accessibilityLabel={strings.profilePage.cancelHandle}
              >
                <X color={colors.textSecondary} size={ICON_SIZE} />
              </Pressable>
            </View>
            <Text style={[typography.bodySm, styles.center, handleError && styles.error]}>{handleMessage}</Text>
          </>
        ) : (
          <View style={styles.nameRow}>
            <Text style={typography.headlineSm} numberOfLines={1}>
              {username ? `@${username}` : strings.profilePage.noHandle}
            </Text>
            <Pressable
              style={styles.iconButton}
              hitSlop={ICON_HIT_SLOP}
              onPress={startEditing}
              accessibilityRole="button"
              accessibilityLabel={strings.profilePage.editHandle}
            >
              <Pencil color={colors.textSecondary} size={ICON_SIZE} />
            </Pressable>
          </View>
        )}
        {savedProblem ? <Text style={[typography.bodySm, styles.center, syncError && styles.error]}>{savedProblem}</Text> : null}

        <View style={styles.trustRow}>
          <ShieldCheck color={isTrusted(trustPoints) ? colors.success : colors.textTertiary} size={ICON_SIZE} />
          <Text style={[typography.bodySm, isTrusted(trustPoints) && styles.trusted]}>
            {isTrusted(trustPoints)
              ? strings.profilePage.trusted
              : trustPoints === null
                ? strings.profilePage.trustSignIn
                : strings.profilePage.trustProgress(trustPoints, TRUST_BADGE_POINTS)}
          </Text>
        </View>

        <FareTypeDropdown />
      </Card>

      {/* B7: Tracking Energy on its own, as a bar under the info card; hidden while tracking is free (D1) */}
      {ENERGY_UI_VISIBLE ? (
        <Pressable
          onPress={energyNeedsSignIn ? () => router.push('/sign-in') : undefined}
          disabled={!energyNeedsSignIn}
          accessibilityRole={energyNeedsSignIn ? 'button' : undefined}
          accessibilityLabel={[strings.profilePage.energy, ...(energy ? [strings.profilePage.energyOf(energy.balance.toFixed(1), ENERGY_WALLET_CAP)] : []), energySubtitle].join('. ')}
        >
          <Card>
            <View style={styles.energyHead}>
              <IconTile icon={Zap} tone="warning" />
              <Text style={[typography.labelLg, styles.grow]}>{strings.profilePage.energy}</Text>
              {energy ? <Text style={[typography.labelLg, styles.energyValue]}>{strings.profilePage.energyOf(energy.balance.toFixed(1), ENERGY_WALLET_CAP)}</Text> : null}
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${energyShare * PERCENT}%` }]} />
            </View>
            <Text style={typography.bodySm}>{energySubtitle}</Text>
          </Card>
        </Pressable>
      ) : null}

      <Card>
        <Text style={typography.labelLg}>{strings.profilePage.stats}</Text>
        <View style={styles.stats}>
          <Stat value={rides.length} label={strings.profilePage.rides} />
          <Stat value={rides.filter((ride) => ride.source === 'checkin').length} label={strings.profilePage.checkins} />
          <Stat value={rides.filter((ride) => ride.source === 'report').length} label={strings.profilePage.reports} />
        </View>
      </Card>

      <BadgesCard />

      <PlacesCard />

      {/* B7: every action, not only Energy; folded until opened, with Clear History */}
      <Card>
        <Pressable
          style={styles.historyHead}
          onPress={() => setHistoryOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: historyOpen }}
        >
          <Text style={[typography.labelLg, styles.grow]}>{strings.profilePage.history(history.length)}</Text>
          {historyOpen ? <ChevronUp color={colors.textSecondary} size={ICON_SIZE} /> : <ChevronDown color={colors.textSecondary} size={ICON_SIZE} />}
        </Pressable>
        {historyOpen ? (
          <>
            {history.length === 0 ? (
              <Text style={typography.bodySm}>
                {ENERGY_UI_VISIBLE ? strings.profilePage.historyEmpty(ENERGY_PASSIVE_INTERVAL_H) : strings.profilePage.historyEmptyNoEnergy}
              </Text>
            ) : (
              history.map((item, index) => (
                <View key={`${item.type}-${item.atMs}-${index}`} style={styles.historyRow}>
                  {item.type === 'ride' ? <Bus color={colors.textSecondary} size={ICON_SIZE} /> : <Zap color={colors.textSecondary} size={ICON_SIZE} />}
                  <View style={styles.grow}>
                    <Text style={typography.bodyMd}>
                      {item.type === 'ride'
                        ? strings.profilePage.historyRide(item.routeCode, item.stationCode)
                        : (strings.profilePage.energyKinds[item.kind as keyof typeof strings.profilePage.energyKinds] ?? item.kind)}
                    </Text>
                    <Text style={typography.bodySm}>{HISTORY_TIME.format(new Date(item.atMs))}</Text>
                  </View>
                  {item.type === 'energy' ? (
                    <Text style={[typography.labelLg, item.amount > 0 ? styles.earned : styles.muted]}>{strings.profilePage.energyAmount(item.amount)}</Text>
                  ) : null}
                </View>
              ))
            )}
            {history.length > 0 ? <Button label={strings.profilePage.clearHistory} variant="text" onPress={confirmClear} /> : null}
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

const HISTORY_TIME = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function Stat({ value, label }: { value: number; label: string }) {
  const styles = useStyles();
  const { typography } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[typography.headlineMd, styles.primary]}>{value}</Text>
      <Text style={typography.bodySm}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  hero: {
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingVertical: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // The pencil sits beside the name, so the name stays centred
    paddingLeft: ICON_BUTTON + spacing.xs,
  },
  editRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    width: ICON_BUTTON,
    height: ICON_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trusted: {
    color: colors.success,
    fontWeight: '600',
  },
  center: {
    textAlign: 'center',
  },
  grow: {
    flex: 1,
  },
  muted: {
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
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
  error: {
    color: colors.danger,
  },
  stats: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  primary: {
    color: colors.primary,
  },
  energyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  energyValue: {
    color: colors.warning,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: BAR_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fill: {
    height: BAR_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.warning,
  },
  historyHead: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  earned: {
    color: colors.success,
  },
}));

import { router } from 'expo-router';
import { Database, History, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Card, Screen, SettingsGroup, SettingsRow } from '@/components';
import { useRefillCountdown } from '@/features/energy/useRefillCountdown';
import { Avatar } from '@/features/profile/Avatar';
import { AvatarPicker, ShuffleAvatarChip } from '@/features/profile/AvatarPicker';
import { FareTypeChips } from '@/features/ride/FareTypeChips';
import { usernameIssue } from '@/shared/backend/rules';
import {
  ENERGY_PASSIVE_INTERVAL_H,
  ENERGY_WALLET_CAP,
  FARE_DISCOUNT_MULTIPLIER,
  FARE_DISCOUNTED_CLASSES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '@/shared/config';
import { useEnergyStore } from '@/state/energyStore';
import { useFareType } from '@/state/fareType';
import { useProfileStore } from '@/state/profileStore';
import { useRidesStore } from '@/state/ridesStore';
import { useSessionStore } from '@/state/sessionStore';
import { syncUsername, useUsernameStore } from '@/state/usernameStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const AVATAR_SIZE = spacing.xl * 3;
const PERCENT = 100;
const DISCOUNT_PERCENT = Math.round((1 - FARE_DISCOUNT_MULTIPLIER) * PERCENT);

// Profile (restyle), opened from the menu or the avatar: avatar, handle, fare type and ride counts.
// Everything but the handle stays on this phone; the handle is sent when the user signs in, and
// saved to the account at once while signed in (SB2). Tracking Energy and its history (SB2).
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
  const [fareType] = useFareType();
  const [handle, setHandle] = useState(username ?? '');
  const issue = handle.length === 0 ? null : usernameIssue(handle);
  const valid = issue === null;
  const discounted = FARE_DISCOUNTED_CLASSES.includes(fareType);

  const save = () => {
    if (handle.length === 0 || !valid || handle === username) return;
    setUsername(handle);
    if (signedIn) void syncUsername();
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

  // Signed out on live data: there is no wallet until there is an account
  const energyNeedsSignIn = !energy && energySource === 'live';
  const energySubtitle = energy
    ? [
        strings.profilePage.energyBalance(energy.balance.toFixed(1), ENERGY_WALLET_CAP),
        ...(refillIn ? [strings.profilePage.energyRefill(refillIn)] : []),
        ...(energy.nextRefillMs === null ? [strings.profilePage.energyFull] : []),
        ...(energy.enabled ? [] : [strings.profilePage.energyFree]),
      ].join(' · ')
    : energyNeedsSignIn
      ? strings.profilePage.energySignIn
      : strings.profilePage.energyFree;

  return (
    <Screen title={strings.profilePage.title}>
      <Card style={styles.hero}>
        <Avatar id={avatarId} size={AVATAR_SIZE} />
        <Text style={typography.headlineSm}>{username ?? strings.profilePage.noHandle}</Text>
        <View style={styles.fareChip}>
          <Text style={[typography.labelSm, styles.fareText]}>
            {discounted
              ? [strings.classification.labels[fareType], strings.onboarding.discount(DISCOUNT_PERCENT)].join(' · ')
              : strings.classification.labels[fareType]}
          </Text>
        </View>
      </Card>

      <View style={styles.row}>
        <Text style={[typography.overline, styles.grow]}>{strings.settings.avatar}</Text>
        <ShuffleAvatarChip />
      </View>
      <AvatarPicker />

      <Text style={typography.overline}>{strings.profilePage.handle}</Text>
      <View style={[styles.input, handleError && styles.inputError]}>
        <Text style={[typography.bodyLg, styles.muted]}>@</Text>
        <TextInput
          style={[typography.bodyLg, styles.grow]}
          value={handle}
          onChangeText={(text) => setHandle(text.trim())}
          onEndEditing={save}
          onSubmitEditing={save}
          placeholder={strings.onboarding.handlePlaceholder}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={USERNAME_MAX_LENGTH}
          accessibilityLabel={strings.profilePage.handle}
        />
      </View>
      <Text style={[typography.bodySm, handleError && styles.error]}>{handleMessage}</Text>

      <Text style={typography.overline}>{strings.profilePage.fareType}</Text>
      <FareTypeChips />

      <Card>
        <Text style={typography.labelLg}>{strings.profilePage.stats}</Text>
        <View style={styles.stats}>
          <Stat value={rides.length} label={strings.profilePage.rides} />
          <Stat value={rides.filter((ride) => ride.source === 'checkin').length} label={strings.profilePage.checkins} />
          <Stat value={rides.filter((ride) => ride.source === 'report').length} label={strings.profilePage.reports} />
        </View>
      </Card>

      <SettingsGroup>
        <SettingsRow
          first
          icon={Zap}
          tone="warning"
          title={strings.profilePage.energy}
          subtitle={energySubtitle}
          onPress={energyNeedsSignIn ? () => router.push('/sign-in') : undefined}
        />
        <SettingsRow icon={Database} title={strings.profilePage.storage} detail={strings.settings.localOnly} />
        <SettingsRow icon={History} title={strings.profilePage.locationHistory} detail={strings.profilePage.none} />
      </SettingsGroup>

      {energy ? (
        <Card>
          <Text style={typography.labelLg}>{strings.profilePage.energyHistory}</Text>
          {energy.history.length === 0 ? (
            <Text style={typography.bodySm}>{strings.profilePage.energyEmpty(ENERGY_PASSIVE_INTERVAL_H)}</Text>
          ) : (
            energy.history.map((entry, index) => (
              <View key={`${entry.atMs}-${index}`} style={styles.historyRow}>
                <View style={styles.grow}>
                  <Text style={typography.bodyMd}>{strings.profilePage.energyKinds[entry.kind]}</Text>
                  <Text style={typography.bodySm}>{HISTORY_TIME.format(new Date(entry.atMs))}</Text>
                </View>
                <Text style={[typography.labelLg, entry.amount > 0 ? styles.earned : styles.muted]}>
                  {strings.profilePage.energyAmount(entry.amount)}
                </Text>
              </View>
            ))
          )}
        </Card>
      ) : null}
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
    paddingVertical: spacing.lg,
  },
  fareChip: {
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.successContainer,
  },
  fareText: {
    color: colors.success,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
  muted: {
    color: colors.textSecondary,
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

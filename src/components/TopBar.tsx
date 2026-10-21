import { router } from 'expo-router';
import { Bell, Menu, WifiOff, Zap } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useRefillCountdown } from '@/features/energy/useRefillCountdown';
import { TrustedAvatar } from '@/features/profile/TrustedAvatar';
import { TourTarget } from '@/features/tour/TourTarget';
import type { TourStepId } from '@/shared/ui/tourPlacement';
import { ENERGY_UI_VISIBLE, ENERGY_WALLET_CAP } from '@/shared/config';
import { useConnectionStore } from '@/state/connectionStore';
import { useEnergyStore } from '@/state/energyStore';
import { useFareType } from '@/state/fareType';
import { useProfileStore } from '@/state/profileStore';
import { useUsernameStore } from '@/state/usernameStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const AVATAR_SIZE = spacing.xl + spacing.xs;
const ICON_SIZE = spacing.md + spacing.xs;
// The icons sit close together; the slop keeps each touch target at 48 dp
const ICON_BOX = spacing.xl + spacing.sm;
const ICON_HIT_SLOP = (MIN_TOUCH_TARGET - ICON_BOX) / 2;

// The bar at the top of every tab (restyle): the user's avatar, handle and fare type (opens
// Profile), the Tracking Energy balance and the refill countdown under it (SB2, opens Profile; hidden
// while tracking is free, D1), and the bell and the menu close together on the right. It floats over
// the map on the map tabs and sits at the top of the list tabs. Offline, a banner sits under it (PRD 14).
// ST2-D: whole Energy as "3", part of one as "3.3" (check-ins earn 0.3)
const energyText = (balance: number) => (Number.isInteger(balance) ? String(balance) : balance.toFixed(1));

// ST2-D: a control the tips tour points at, when this top bar is the Map tab's
function Tour({ id, on, children }: { id: TourStepId; on: boolean; children: ReactNode }) {
  return on ? <TourTarget id={id}>{children}</TourTarget> : <>{children}</>;
}

// ST2-D: `tour` marks the profile and menu for the tips tour (the Map tab's top bar only)
export function TopBar({ tour = false }: { tour?: boolean }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const avatarId = useProfileStore((state) => state.avatarId);
  const username = useUsernameStore((state) => state.username);
  const [fareType] = useFareType();
  const energy = useEnergyStore((state) => state.snapshot);
  const refillIn = useRefillCountdown();
  const offline = useConnectionStore((state) => state.online === false);
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Tour id="profile" on={tour}>
          <Pressable style={styles.who} onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={strings.profilePage.title}>
            <TrustedAvatar id={avatarId} size={AVATAR_SIZE} />
            <View style={styles.text}>
              <Text style={typography.labelLg} numberOfLines={1}>
                {username ?? strings.topBar.guest}
              </Text>
              <Text style={typography.bodySm} numberOfLines={1}>
                {strings.classification.labels[fareType]}
              </Text>
            </View>
          </Pressable>
        </Tour>
        <View style={styles.grow} />
        {ENERGY_UI_VISIBLE && energy ? (
          <Pressable
            style={styles.energy}
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel={strings.topBar.energy(energyText(energy.balance), refillIn)}
          >
            <Zap color={colors.warning} size={ICON_SIZE - spacing.xs} />
            <View>
              <Text style={typography.labelLg}>{strings.topBar.energyOf(energyText(energy.balance), ENERGY_WALLET_CAP)}</Text>
              {refillIn ? <Text style={[typography.bodySm, styles.refill]}>{refillIn}</Text> : null}
            </View>
          </Pressable>
        ) : null}
        <View style={styles.icons}>
          <Pressable
            style={styles.icon}
            hitSlop={ICON_HIT_SLOP}
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={strings.topBar.notifications}
          >
            <Bell color={colors.textPrimary} size={ICON_SIZE} />
          </Pressable>
          <Tour id="menu" on={tour}>
            <Pressable
              style={styles.icon}
              hitSlop={ICON_HIT_SLOP}
              onPress={() => router.push('/menu')}
              accessibilityRole="button"
              accessibilityLabel={strings.menu.open}
            >
              <Menu color={colors.textPrimary} size={ICON_SIZE} />
            </Pressable>
          </Tour>
        </View>
      </View>
      {offline ? (
        <View style={styles.offline} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <WifiOff color={colors.warning} size={ICON_SIZE - spacing.xs} />
          <Text style={[typography.labelMd, styles.offlineText]}>{strings.topBar.offline}</Text>
        </View>
      ) : null}
    </View>
  );
}

// CA1.1: the bar's height, so a sheet over a screen with it can stop just below
export const TOP_BAR_HEIGHT = MIN_TOUCH_TARGET + spacing.sm;

const useStyles = makeStyles(({ colors, elevation }) => ({
  wrap: {
    gap: spacing.xs,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.card,
    ...elevation.level2,
  },
  who: {
    flexShrink: 1,
    minHeight: TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    flexShrink: 1,
  },
  grow: {
    flex: 1,
  },
  energy: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  refill: {
    color: colors.textSecondary,
  },
  icons: {
    flexDirection: 'row',
    paddingRight: spacing.xs,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + spacing.xs / 2,
    borderRadius: radii.pill,
    backgroundColor: colors.warningContainer,
    ...elevation.level2,
  },
  offlineText: {
    color: colors.warning,
  },
  icon: {
    width: ICON_BOX,
    height: ICON_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

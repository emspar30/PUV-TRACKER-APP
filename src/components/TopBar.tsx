import { router } from 'expo-router';
import { Bell, Menu, Zap } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useRefillCountdown } from '@/features/energy/useRefillCountdown';
import { TrustedAvatar } from '@/features/profile/TrustedAvatar';
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
// Profile), the Tracking Energy balance and the refill countdown under it (SB2, opens Profile), and the bell and the menu close together
// on the right. It floats over the map on the map tabs and sits at the top of the list tabs.
export function TopBar() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const avatarId = useProfileStore((state) => state.avatarId);
  const username = useUsernameStore((state) => state.username);
  const [fareType] = useFareType();
  const energy = useEnergyStore((state) => state.snapshot);
  const refillIn = useRefillCountdown();
  return (
    <View style={styles.bar}>
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
      <View style={styles.grow} />
      {energy ? (
        <Pressable
          style={styles.energy}
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel={strings.topBar.energy(energy.balance.toFixed(1), refillIn)}
        >
          <Zap color={colors.warning} size={ICON_SIZE - spacing.xs} />
          <View>
            <Text style={typography.labelLg}>{energy.balance.toFixed(1)}</Text>
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
        <Pressable
          style={styles.icon}
          hitSlop={ICON_HIT_SLOP}
          onPress={() => router.push('/menu')}
          accessibilityRole="button"
          accessibilityLabel={strings.menu.open}
        >
          <Menu color={colors.textPrimary} size={ICON_SIZE} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
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
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
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
  icon: {
    width: ICON_BOX,
    height: ICON_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

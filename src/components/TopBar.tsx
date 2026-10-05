import { router } from 'expo-router';
import { Bell, Settings } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/features/profile/Avatar';
import { useFareType } from '@/state/fareType';
import { useProfileStore } from '@/state/profileStore';
import { useUsernameStore } from '@/state/usernameStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const AVATAR_SIZE = spacing.xl + spacing.xs;
const ICON_SIZE = spacing.md + spacing.xs;

// The bar at the top of every tab (restyle): the user's avatar, handle and fare type, the
// notifications bell, and Settings.
// It floats over the map on the map tabs and sits at the top of the list tabs.
export function TopBar() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const avatarId = useProfileStore((state) => state.avatarId);
  const username = useUsernameStore((state) => state.username);
  const [fareType] = useFareType();
  const openSettings = () => router.push('/settings');
  return (
    <View style={styles.bar}>
      <Pressable style={styles.who} onPress={openSettings} accessibilityRole="button" accessibilityLabel={strings.settings.open}>
        <Avatar id={avatarId} size={AVATAR_SIZE} />
        <View style={styles.text}>
          <Text style={typography.labelLg} numberOfLines={1}>
            {username ?? strings.topBar.guest}
          </Text>
          <Text style={typography.bodySm} numberOfLines={1}>
            {strings.classification.labels[fareType]}
          </Text>
        </View>
      </Pressable>
      <Pressable
        style={styles.icon}
        onPress={() => router.push('/notifications')}
        accessibilityRole="button"
        accessibilityLabel={strings.topBar.notifications}
      >
        <Bell color={colors.textPrimary} size={ICON_SIZE} />
      </Pressable>
      <Pressable style={styles.icon} onPress={openSettings} accessibilityRole="button" accessibilityLabel={strings.settings.open}>
        <Settings color={colors.textPrimary} size={ICON_SIZE} />
      </Pressable>
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
    flex: 1,
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    flex: 1,
  },
  icon: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

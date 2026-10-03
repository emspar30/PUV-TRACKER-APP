import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Avatar } from '@/features/profile/Avatar';
import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, spacing } from '@/theme';

const AVATAR_SIZE = spacing.xl + spacing.sm;

// The user's avatar at the top right of every tab. Opens the Settings sheet.
export function AvatarButton() {
  const styles = useStyles();
  const avatarId = useProfileStore((state) => state.avatarId);
  return (
    <Pressable
      style={styles.button}
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel={strings.settings.open}
    >
      <Avatar id={avatarId} size={AVATAR_SIZE} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  button: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sheet,
    ...elevation.level2,
  },
}));

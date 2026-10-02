import { Pressable, StyleSheet, View } from 'react-native';

import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, colors, spacing } from '@/theme';

import { AVATAR_IDS, Avatar } from './Avatar';

const AVATAR_SIZE = MIN_TOUCH_TARGET;
const RING = spacing.xs;

// A grid of the preset avatars. The choice is saved on this phone only (PRD 7.1).
export function AvatarPicker() {
  const avatarId = useProfileStore((state) => state.avatarId);
  const setAvatarId = useProfileStore((state) => state.setAvatarId);

  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {AVATAR_IDS.map((id) => {
        const selected = id === avatarId;
        return (
          <Pressable
            key={id}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => setAvatarId(id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={strings.avatar.option(id + 1)}
          >
            <Avatar id={id} size={AVATAR_SIZE} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    padding: RING,
    borderRadius: AVATAR_SIZE,
    borderWidth: RING / 2,
    borderColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.cyan,
  },
});

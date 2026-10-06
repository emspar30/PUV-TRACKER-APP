import { Pressable, View } from 'react-native';

import { Chip } from '@/components';
import { avatarSetFor } from '@/shared/profile/avatarPick';
import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, spacing } from '@/theme';

import { Avatar } from './Avatar';

const AVATAR_SIZE = MIN_TOUCH_TARGET;
const RING = spacing.xs;

// A grid of the avatars in the user's own set: the six for the gender answer, or all twelve for
// "Prefer not to say" or no answer (decision after F1 review). The choice is saved on this phone only.
// B7: onPick lets Profile close the grid again after a choice.
export function AvatarPicker({ onPick }: { onPick?: () => void } = {}) {
  const styles = useStyles();
  const avatarId = useProfileStore((state) => state.avatarId);
  const setAvatarId = useProfileStore((state) => state.setAvatarId);
  const gender = useProfileStore((state) => state.gender);

  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {avatarSetFor(gender).map((id) => {
        const selected = id === avatarId;
        return (
          <Pressable
            key={id}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => {
              setAvatarId(id);
              onPick?.();
            }}
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

// Picks another avatar from the set for the user's gender answer (PRD 19, D3). B7: onboarding only
export function ShuffleAvatarChip() {
  const shuffleAvatar = useProfileStore((state) => state.shuffleAvatar);
  return <Chip label={strings.settings.shuffle} accessibilityLabel={strings.settings.shuffleLabel} onPress={shuffleAvatar} />;
}

const useStyles = makeStyles(({ colors }) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  option: {
    padding: RING,
    borderRadius: AVATAR_SIZE,
    borderWidth: RING / 2,
    borderColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.primary,
  },
}));

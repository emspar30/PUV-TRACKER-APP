import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BentoCard, BentoGrid, Screen } from '@/components';
import { AccountCard } from '@/features/profile/AccountCard';
import { Avatar } from '@/features/profile/Avatar';
import { AvatarPicker } from '@/features/profile/AvatarPicker';
import { ClassificationPicker } from '@/features/profile/ClassificationPicker';
import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, colors, spacing, typography } from '@/theme';

const AVATAR_SIZE = spacing.xl * 2;
const ICON_SIZE = spacing.md + spacing.xs;

export default function ProfileScreen() {
  const avatarId = useProfileStore((state) => state.avatarId);
  const classification = useProfileStore((state) => state.classification);

  return (
    <Screen title={strings.profile.title}>
      <BentoGrid>
        <BentoCard span={2}>
          <View style={styles.header}>
            <Avatar id={avatarId} size={AVATAR_SIZE} />
            <View style={styles.grow}>
              <Text style={typography.body}>{strings.classification.labels[classification]}</Text>
              <Text style={typography.caption}>{strings.avatar.note}</Text>
            </View>
          </View>
          <Text style={typography.body}>{strings.avatar.title}</Text>
          <AvatarPicker />
        </BentoCard>

        <BentoCard span={2}>
          <Text style={typography.body}>{strings.classification.title}</Text>
          <Text style={typography.caption}>{strings.classification.note}</Text>
          <ClassificationPicker />
        </BentoCard>

        <BentoCard span={2}>
          <Text style={typography.body}>{strings.profile.teamAccount}</Text>
          <AccountCard />
        </BentoCard>

        <BentoCard span={2}>
          <Text style={typography.body}>{strings.profile.more}</Text>
          <LinkRow label={strings.profile.about} onPress={() => router.push('/about')} />
          <LinkRow label={strings.profile.replayOnboarding} onPress={() => router.push('/onboarding')} />
        </BentoCard>
      </BentoGrid>
    </Screen>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.link} onPress={onPress} accessibilityRole="button">
      <Text style={[typography.body, styles.grow]}>{label}</Text>
      <ChevronRight color={colors.textMuted} size={ICON_SIZE} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  grow: {
    flex: 1,
  },
  link: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

import { router } from 'expo-router';
import { ChevronRight, X } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components';
import { AccountCard } from '@/features/profile/AccountCard';
import { AvatarPicker, ShuffleAvatarChip } from '@/features/profile/AvatarPicker';
import { FareTypeChips } from '@/features/ride/FareTypeChips';
import { useSettingsStore } from '@/state/settingsStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme, type ThemeScheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;
const SCHEMES: ThemeScheme[] = ['light', 'dark'];
const SCHEME_LABEL: Record<ThemeScheme, string> = { light: strings.settings.light, dark: strings.settings.dark };
// The sheet never covers more of the screen than this share
const MAX_HEIGHT_SHARE = '88%';

// Settings, opened from the avatar button at the top right of each tab. Everything here is stored
// on this phone only: fare type, theme and avatar are never sent anywhere.
export default function SettingsSheet() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  return (
    <View style={styles.root}>
      {/* Tapping the dimmed map behind the sheet closes it */}
      <Pressable
        style={styles.scrim}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={strings.settings.close}
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <Text style={[typography.headlineSm, styles.grow]} accessibilityRole="header">
            {strings.settings.title}
          </Text>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={strings.settings.close}
          >
            <X color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={typography.labelLg}>{strings.settings.fareType}</Text>
          {/* The same chips, and the same stored value, as the quick fare-type chip on My Ride */}
          <FareTypeChips />

          <Text style={typography.labelLg}>{strings.settings.theme}</Text>
          <View style={styles.chips}>
            {SCHEMES.map((scheme) => (
              <Chip
                key={scheme}
                label={SCHEME_LABEL[scheme]}
                selected={scheme === theme}
                onPress={() => setTheme(scheme)}
              />
            ))}
          </View>

          <View style={styles.labelRow}>
            <Text style={[typography.labelLg, styles.grow]}>{strings.settings.avatar}</Text>
            <ShuffleAvatarChip />
          </View>
          <AvatarPicker />

          <View style={styles.divider} />
          <LinkRow label={strings.settings.about} onPress={() => router.push('/about')} />
          <LinkRow label={strings.settings.replayIntro} onPress={() => router.push('/onboarding')} />

          <View style={styles.divider} />
          <Text style={typography.labelLg}>{strings.settings.account}</Text>
          <AccountCard />
        </ScrollView>
      </View>
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <Pressable style={styles.link} onPress={onPress} accessibilityRole="button">
      <Text style={[typography.bodyLg, styles.grow]}>{label}</Text>
      <ChevronRight color={colors.textSecondary} size={ICON_SIZE} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.shadow,
    opacity: 0.32,
  },
  sheet: {
    maxHeight: MAX_HEIGHT_SHARE,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.sheet,
    ...elevation.level3,
  },
  handle: {
    alignSelf: 'center',
    width: spacing.xl,
    height: spacing.xs,
    marginTop: spacing.sm,
    borderRadius: spacing.xs,
    backgroundColor: colors.outline,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm + spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.outline,
  },
  link: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
}));

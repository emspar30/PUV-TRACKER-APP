import { router } from 'expo-router';
import { FlaskConical, Info, LogIn, LogOut, PlayCircle, Settings, UserRound, X } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo, SettingsGroup, SettingsRow } from '@/components';
import { signOut } from '@/services/auth';
import { useSessionStore } from '@/state/sessionStore';
import { useUsernameStore } from '@/state/usernameStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;
const LOGO_SIZE = spacing.xl + spacing.sm;
// The sheet never covers more of the screen than this share
const MAX_HEIGHT_SHARE = '88%';
const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

// The burger menu (restyle): the account, then Profile, Settings, Demo & simulation, About, and
// sign in or out. It slides up over the current tab.
export default function MenuSheet() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const status = useSessionStore((state) => state.status);
  const email = useSessionStore((state) => state.email);
  const username = useUsernameStore((state) => state.username);

  // Each item replaces the menu, so Back from that page returns to the tab
  const go = (path: '/profile' | '/settings' | '/demo-settings' | '/about' | '/onboarding' | '/sign-in') => {
    router.back();
    router.push(path);
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.scrim} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={strings.menu.close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <Logo size={LOGO_SIZE} />
          <View style={styles.grow}>
            <Text style={typography.headlineSm} numberOfLines={1}>
              {username ?? strings.topBar.guest}
            </Text>
            <Text style={typography.bodySm} numberOfLines={1}>
              {status === 'signed-in' && email ? strings.menu.signedInAs(email) : strings.menu.guest}
            </Text>
          </View>
          <Pressable style={styles.close} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={strings.menu.close}>
            <X color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <SettingsGroup>
            <SettingsRow first icon={UserRound} title={strings.menu.profile} onPress={() => go('/profile')} />
            <SettingsRow icon={Settings} title={strings.menu.settings} onPress={() => go('/settings')} />
            <SettingsRow icon={FlaskConical} tone="warning" title={strings.menu.demo} onPress={() => go('/demo-settings')} />
          </SettingsGroup>
          <SettingsGroup>
            <SettingsRow first icon={Info} title={strings.menu.about} onPress={() => go('/about')} />
            <SettingsRow icon={PlayCircle} title={strings.menu.replayIntro} onPress={() => go('/onboarding')} />
          </SettingsGroup>
          {status === 'signed-in' ? (
            <SettingsGroup>
              <SettingsRow
                first
                icon={LogOut}
                destructive
                title={strings.menu.signOut}
                onPress={() => {
                  void signOut();
                  router.back();
                }}
              />
            </SettingsGroup>
          ) : status === 'signed-out' ? (
            <SettingsGroup>
              <SettingsRow first icon={LogIn} title={strings.menu.signIn} onPress={() => go('/sign-in')} />
            </SettingsGroup>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...FILL,
    backgroundColor: colors.scrim,
  },
  sheet: {
    maxHeight: MAX_HEIGHT_SHARE,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.canvas,
  },
  handle: {
    alignSelf: 'center',
    width: spacing.xl,
    height: spacing.xs,
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingLeft: spacing.md,
    paddingTop: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  close: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
  },
}));

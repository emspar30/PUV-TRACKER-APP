import { router } from 'expo-router';
import { FlaskConical, Info, LogIn, LogOut, MessageCircleQuestionMark, PlayCircle, Settings, UserRound } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Logo, Screen, SettingsGroup, SettingsRow } from '@/components';
import { signOut } from '@/services/auth';
import { useSessionStore } from '@/state/sessionStore';
import { useUsernameStore } from '@/state/usernameStore';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

const LOGO_SIZE = spacing.xl + spacing.sm;

// The burger menu (restyle, B1): the account, then Profile, Settings, Ask Tunton (CA1), Demo & simulation, About, and
// sign in or out. A full page that slides in from the right, with no dimmed backdrop; Back from an
// item returns here.
export default function MenuScreen() {
  const styles = useStyles();
  const { typography } = useTheme();
  const status = useSessionStore((state) => state.status);
  const email = useSessionStore((state) => state.email);
  const username = useUsernameStore((state) => state.username);

  const go = (path: '/profile' | '/settings' | '/assistant' | '/demo-settings' | '/about' | '/onboarding' | '/sign-in') => router.push(path);

  return (
    <Screen title={strings.menu.title}>
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
      </View>
      <SettingsGroup>
        <SettingsRow first icon={UserRound} title={strings.menu.profile} onPress={() => go('/profile')} />
        <SettingsRow icon={Settings} title={strings.menu.settings} onPress={() => go('/settings')} />
        <SettingsRow icon={MessageCircleQuestionMark} title={strings.menu.assistant} onPress={() => go('/assistant')} />
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
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  grow: {
    flex: 1,
  },
}));

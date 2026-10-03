import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { signOut } from '@/services/auth';
import { useSessionStore } from '@/state/sessionStore';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, radii, spacing, useTheme } from '@/theme';

// Shows the backend sign-in state and the sign-in or sign-out action.
export function AccountCard() {
  const styles = useStyles();
  const { typography } = useTheme();
  const status = useSessionStore((state) => state.status);
  const email = useSessionStore((state) => state.email);

  if (status === 'unconfigured') {
    return (
      <View style={styles.root}>
        <Text style={typography.caption}>{strings.profile.backendMissing}</Text>
      </View>
    );
  }

  if (status === 'loading') {
    return (
      <View style={styles.root}>
        <Text style={typography.caption}>{strings.profile.checkingSignIn}</Text>
      </View>
    );
  }

  if (status === 'signed-in') {
    return (
      <View style={styles.root}>
        <Text style={typography.caption}>{strings.profile.signedInAs(email)}</Text>
        <Pressable style={styles.button} onPress={() => void signOut()} accessibilityRole="button">
          <Text style={typography.body}>{strings.profile.signOut}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={typography.caption}>{strings.profile.signedOut}</Text>
      <Pressable style={styles.button} onPress={() => router.push('/sign-in')} accessibilityRole="button">
        <Text style={typography.body}>{strings.profile.signIn}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    gap: spacing.sm,
  },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
  },
}));

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { signOut } from '@/services/auth';
import { useSessionStore } from '@/state/sessionStore';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

// Shows the backend sign-in state and the sign-in or sign-out action.
export function AccountCard() {
  const status = useSessionStore((state) => state.status);
  const email = useSessionStore((state) => state.email);

  if (status === 'unconfigured') {
    return (
      <View style={styles.root}>
        <Text style={typography.caption}>
          The backend is not set up on this build, so live vehicle positions are unavailable. The map, routing and
          fares work without it.
        </Text>
      </View>
    );
  }

  if (status === 'loading') {
    return (
      <View style={styles.root}>
        <Text style={typography.caption}>Checking sign-in</Text>
      </View>
    );
  }

  if (status === 'signed-in') {
    return (
      <View style={styles.root}>
        <Text style={typography.caption}>Signed in as {email ?? 'a team account'}</Text>
        <Pressable style={styles.button} onPress={() => void signOut()} accessibilityRole="button">
          <Text style={typography.body}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={typography.caption}>Not signed in. Sign in with a team account to see live vehicle positions.</Text>
      <Pressable style={styles.button} onPress={() => router.push('/sign-in')} accessibilityRole="button">
        <Text style={typography.body}>Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
});

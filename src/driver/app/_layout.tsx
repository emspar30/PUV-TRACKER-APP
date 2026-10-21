import { Stack } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme } from '@/theme';

// The driver app's root (APP_VARIANT=driver; app.config.js points Expo Router here).
// One-way by design (PRD 6.2): nothing under src/driver may reach the cloud; lint enforces it.
// DR4: the screen stays on while the app is open, as a dashboard phone on the vehicle charger.
// Unmounted after its activity is gone (a reload with the app in the background), releasing the
// lock is refused; nothing is left to release, so that is not reported as an error.
export default function DriverLayout() {
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}

function ThemedStack() {
  const { scheme, colors } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </>
  );
}

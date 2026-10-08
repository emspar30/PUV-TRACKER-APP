import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DialogHost, ToastHost } from '@/components';
import { RouteDataProvider } from '@/data/RouteDataProvider';
import { startEnergySync } from '@/state/energyStore';
import { startSessionTracking } from '@/state/sessionStore';
import { ThemeProvider, useTheme } from '@/theme';

const FILL = { flex: 1 } as const;

// ST2-A: the system splash stays up until the route data is ready (RouteDataProvider hides it), so
// there is no second logo screen after it. Called here, at load, so it runs before the first frame.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (a fast refresh); nothing to hold
});

export default function RootLayout() {
  // Follows backend sign-in (does nothing when the backend keys are absent) and the Energy wallet
  useEffect(() => {
    startSessionTracking();
    startEnergySync();
  }, []);

  return (
    // Needed for the draggable bottom sheet and any other gesture
    <GestureHandlerRootView style={FILL}>
      <ThemeProvider>
        <RouteDataProvider>
          <ThemedStack />
        </RouteDataProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStack() {
  const { scheme, colors } = useTheme();
  return (
    <>
      {/* Dark icons on the light theme, light icons on the dark one */}
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      {/* Every page, the menu included, slides in from the right over the whole screen, with no dimming */}
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.canvas } }} />
      <DialogHost />
      {/* EQ-14: after the dialog, so a notice (such as Badge earned) is not under its dimmed backdrop */}
      <ToastHost />
    </>
  );
}

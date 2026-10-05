import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DialogHost, LoadingScreen } from '@/components';
import { RouteDataProvider } from '@/data/RouteDataProvider';
import { LOADING_MIN_MS } from '@/shared/config';
import { startEnergySync } from '@/state/energyStore';
import { startSessionTracking } from '@/state/sessionStore';
import { ThemeProvider, useTheme } from '@/theme';

const FILL = { flex: 1 } as const;

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
  // Every launch opens on the loading screen, then the introduction (first launch) or the tabs
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), LOADING_MIN_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!started) return <LoadingScreen />;
  return (
    <>
      {/* Dark icons on the light theme, light icons on the dark one */}
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      {/* Every page, the menu included, slides in from the right over the whole screen, with no dimming */}
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.canvas } }} />
      <DialogHost />
    </>
  );
}

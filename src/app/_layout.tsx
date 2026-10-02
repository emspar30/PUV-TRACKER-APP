import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { RouteDataProvider } from '@/data/RouteDataProvider';
import { startSessionTracking } from '@/state/sessionStore';
import { colors } from '@/theme';

export default function RootLayout() {
  // Follows backend sign-in. Does nothing when the backend keys are absent.
  useEffect(() => {
    startSessionTracking();
  }, []);

  return (
    <RouteDataProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </RouteDataProvider>
  );
}

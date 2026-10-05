import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { RouteDataProvider } from '@/data/RouteDataProvider';
import { startSessionTracking } from '@/state/sessionStore';
import { ThemeProvider, useTheme } from '@/theme';

const FILL = { flex: 1 } as const;

export default function RootLayout() {
  // Follows backend sign-in. Does nothing when the backend keys are absent.
  useEffect(() => {
    startSessionTracking();
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
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        {/* The menu slides up over the current tab, which stays visible behind a dimmed backdrop */}
        <Stack.Screen
          name="menu"
          options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }}
        />
      </Stack>
    </>
  );
}

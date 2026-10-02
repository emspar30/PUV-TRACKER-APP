import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { RouteDataProvider } from '@/data/RouteDataProvider';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <RouteDataProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    </RouteDataProvider>
  );
}

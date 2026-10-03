import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrateDb } from '@/data/db/migrate';
import { DATABASE_NAME } from '@/data/db/schema';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      {/* Screens render only after the tables exist and the route data is loaded */}
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDb}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
      </SQLiteProvider>
    </>
  );
}

import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RouteData } from '@/shared/routing/types';
import { colors, spacing, typography } from '@/theme';

import { migrateRouteDb, type Db } from './db/migrate';
import { loadRouteData } from './db/routeRepository';
import { getSeedRouteData } from './routeSource';

const DATABASE_NAME = 'tunton.db';

const RouteDataContext = createContext<RouteData | null>(null);

// Route lines, stops and fare parameters, read from the local database. Works with no network.
export function useRouteData(): RouteData {
  const data = useContext(RouteDataContext);
  if (!data) throw new Error('useRouteData must be used inside RouteDataProvider');
  return data;
}

async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await migrateRouteDb(db as Db, getSeedRouteData());
}

type LoadState = { status: 'loading' } | { status: 'ready'; data: RouteData } | { status: 'error'; message: string };

function RouteDataLoader({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadRouteData(db as Db)
      .then((stored) => {
        if (cancelled) return;
        // The placeholder flag describes the bundled data, which is what the database was seeded from
        setState({ status: 'ready', data: { ...stored, isPlaceholder: getSeedRouteData().isPlaceholder } });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  if (state.status === 'loading') return <View style={styles.fill} />;
  if (state.status === 'error') return <DataError message={state.message} />;
  return <RouteDataContext.Provider value={state.data}>{children}</RouteDataContext.Provider>;
}

function DataError({ message }: { message: string }) {
  return (
    <View style={[styles.fill, styles.centered]}>
      <Text style={typography.body}>The route data could not be loaded.</Text>
      <Text style={[typography.caption, styles.detail]}>{message}</Text>
    </View>
  );
}

export function RouteDataProvider({ children }: { children: ReactNode }) {
  const [initError, setInitError] = useState<string | null>(null);
  if (initError) return <DataError message={initError} />;

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase} onError={(error) => setInitError(error.message)}>
      <RouteDataLoader>{children}</RouteDataLoader>
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  detail: {
    textAlign: 'center',
  },
});

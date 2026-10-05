import { openDatabaseAsync } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LoadingScreen } from '@/components';
import { DB_LOCK_RETRY_ATTEMPTS, DB_LOCK_RETRY_DELAY_MS } from '@/shared/config';
import type { RouteData } from '@/shared/routing/types';
import { reopen, type Closable, type Holder } from '@/shared/util/reopen';
import { isDatabaseLockedError, withRetry } from '@/shared/util/retry';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, radii, spacing, useTheme } from '@/theme';

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

// Opens the database, creates and seeds it if needed, and reads the route data back.
// On a first launch the app can start twice in quick succession; the second start may find the
// database still locked by the first, so a locked database is retried instead of reported.
// Backlog 68: on a Fast Refresh, expo-sqlite gave the new handle the same cached native connection as
// the old one; when the old handle was released it closed that shared connection, and every call
// failed with a NullPointerException ("Try again" got the same broken connection). So each open
// gets its own connection, and the handle opened last (kept on globalThis, which survives a Fast
// Refresh) is closed before a new one is opened.
type OpenDb = Db & Closable;
const OPEN_OPTIONS = { useNewConnection: true } as const;
const globalHolder = globalThis as { __tuntonRouteDb?: Holder<OpenDb> };
const dbHolder: Holder<OpenDb> = (globalHolder.__tuntonRouteDb ??= { current: null });

async function openRouteData(): Promise<RouteData> {
  const seed = getSeedRouteData();
  const stored = await withRetry(
    async () => {
      const db = await reopen(dbHolder, async () => (await openDatabaseAsync(DATABASE_NAME, OPEN_OPTIONS)) as OpenDb);
      await migrateRouteDb(db, seed);
      return loadRouteData(db);
    },
    { attempts: DB_LOCK_RETRY_ATTEMPTS, delayMs: DB_LOCK_RETRY_DELAY_MS, shouldRetry: isDatabaseLockedError },
  );
  // The placeholder flag describes the bundled data, which is what the database was seeded from
  return { ...stored, isPlaceholder: seed.isPlaceholder };
}

type LoadState = { status: 'loading' } | { status: 'ready'; data: RouteData } | { status: 'error'; message: string };

const LOADING: LoadState = { status: 'loading' };

export function RouteDataProvider({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const { typography } = useTheme();
  const [state, setState] = useState<LoadState>(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    openRouteData()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState(LOADING);
    setAttempt((count) => count + 1);
  }, []);

  if (state.status === 'loading') {
    // Shown while the local database is created and seeded, which takes a moment on first launch
    return <LoadingScreen message={strings.loading.routeData} />;
  }

  if (state.status === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={typography.body}>{strings.loading.routeDataFailed}</Text>
        <Text style={[typography.caption, styles.detail]}>{state.message}</Text>
        <Pressable style={styles.button} onPress={retry} accessibilityRole="button">
          <Text style={typography.body}>{strings.common.tryAgain}</Text>
        </Pressable>
      </View>
    );
  }

  return <RouteDataContext.Provider value={state.data}>{children}</RouteDataContext.Provider>;
}

const useStyles = makeStyles(({ colors }) => ({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.canvas,
  },
  detail: {
    textAlign: 'center',
  },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
}));

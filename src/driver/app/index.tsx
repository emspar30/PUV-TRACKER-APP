import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

import { beaconOptions, useBeaconStatus } from '../features/beacon/beacon';
import { StatusStrip } from '../features/status/StatusStrip';
import { useDriverStore } from '../state/driverStore';
import { isBeaconAvailable, isProvisioned, startAdvertising } from '../../../modules/tunton-beacon';

// DR4: the driver's home. Glanceable, nothing to tap (PRD 9.4, 15.3): the status strip (hold it for
// admin), the multicab this phone belongs to, and where the waiting counts will appear (DR5).
export default function DriverHome() {
  const setup = useDriverStore((state) => state.setup);
  const beaconEnabled = useDriverStore((state) => state.beaconEnabled);
  const status = useBeaconStatus();
  const styles = useStyles();
  const { typography } = useTheme();
  // The setup is saved but the phone lost its secrets (a restored backup, a reset lock screen)
  const lostSecrets = setup !== null && isBeaconAvailable() && !isProvisioned();

  // The beacon should be on but the service is not running (a force stop): start it again
  useEffect(() => {
    if (setup && beaconEnabled && !lostSecrets && isBeaconAvailable() && !status.enabled) {
      startAdvertising(beaconOptions()).catch(() => {
        // Shown through the status strip
      });
    }
  }, [setup, beaconEnabled, lostSecrets, status.enabled]);

  if (!setup) return <Redirect href="/provision" />;

  return (
    <Screen title={strings.driver.appName}>
      <StatusStrip status={status} onAdminHold={() => router.push('/admin')} />
      {lostSecrets ? (
        <View style={[styles.card, styles.warning]}>
          <Text style={typography.headlineSm}>{strings.driver.resetNeeded}</Text>
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={typography.display} numberOfLines={1} adjustsFontSizeToFit>
          {setup.plate}
        </Text>
        <Text style={typography.headlineMd}>{strings.driver.route(setup.routeCode)}</Text>
      </View>
      <View style={styles.card}>
        <Text style={typography.bodyLg}>{strings.driver.waitingSoon}</Text>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  warning: {
    backgroundColor: colors.warningContainer,
  },
}));

import { router } from 'expo-router';
import { Bus, Crosshair, MapPin, Pin, RotateCcw, Timer, VenetianMask } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { Chip, Screen, SettingsGroup, SettingsRow } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { signOut } from '@/services/auth';
import { showDialog } from '@/state/dialogStore';
import { resetApp } from '@/state/resetApp';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import { DEMO_COMMUTER_STOP_CODE, FAKE_FIX_ACCURACY_OPTIONS_M, FAKE_FIX_STALE_AGE_S } from '@/shared/config';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

// Demo & simulation (restyle): what the emulator cannot do by itself, and that also works on a
// phone: simulated multicabs, standing at a stop instead of a GPS fix, and resetting the app.
export default function DemoSettingsScreen() {
  const styles = useStyles();
  const { typography } = useTheme();
  const { stops } = useRouteData();
  const s = useSettingsStore();
  const status = useSessionStore((state) => state.status);
  // EQ-15: a stop saved from older route data is not on the list; the default stop stands in
  // (as in useCommuterPosition), so show that one as chosen
  const standing = stops.some((stop) => stop.code === s.simulatedStop) ? s.simulatedStop : DEMO_COMMUTER_STOP_CODE;

  const confirmReset = () =>
    showDialog({
      tone: 'danger',
      icon: RotateCcw,
      title: strings.demo.resetConfirmTitle,
      body: strings.demo.resetConfirmBody,
      actions: [
        {
          label: strings.demo.resetConfirm,
          variant: 'danger',
          onPress: () => {
            if (status === 'signed-in') void signOut();
            resetApp();
            router.dismissAll();
            router.replace('/');
          },
        },
        { label: strings.demo.cancel, variant: 'secondary' },
      ],
    });

  return (
    <Screen title={strings.demo.title}>
      <SettingsGroup title={strings.demo.simulation}>
        <SettingsRow
          first
          icon={Bus}
          title={strings.demo.demoVehicles}
          subtitle={strings.demo.demoVehiclesBody}
          value={s.demoData}
          onValueChange={s.setDemoData}
        />
        <SettingsRow
          icon={MapPin}
          tone="success"
          title={strings.demo.simulatedLocation}
          subtitle={strings.demo.simulatedLocationBody}
          value={s.simulatedLocation}
          onValueChange={s.setSimulatedLocation}
        />
        {/* CA1.1: where to stand, always reachable; pinning a spot turns simulated location on */}
        <SettingsRow
          icon={Pin}
          tone="success"
          title={strings.demo.standSpot}
          subtitle={strings.demo.standSpotBody}
          detail={s.simulatedPoint ? strings.demo.pinnedSpot : standing}
          onPress={() => router.push('/simulated-pin')}
        />
        {__DEV__ ? (
          <SettingsRow icon={Crosshair} tone="warning" title={strings.demo.fakeGps} subtitle={strings.demo.fakeGpsBody} value={s.fakeGps} onValueChange={s.setFakeGps} />
        ) : null}
      </SettingsGroup>

      {/* G0: the fake fix's accuracy, mock flag and age, to try the 25 m and 30 m gates */}
      {__DEV__ && s.fakeGps ? (
        <>
          <View style={styles.stand}>
            <Text style={typography.overline}>{strings.demo.fakeAccuracy}</Text>
            <View style={styles.chips}>
              {FAKE_FIX_ACCURACY_OPTIONS_M.map((metres) => (
                <Chip key={metres} label={strings.demo.fakeAccuracyM(metres)} selected={metres === s.fakeAccuracyM} onPress={() => s.setFake({ fakeAccuracyM: metres })} />
              ))}
            </View>
          </View>
          <SettingsGroup>
            <SettingsRow
              first
              icon={VenetianMask}
              title={strings.demo.fakeMocked}
              subtitle={strings.demo.fakeMockedBody}
              value={s.fakeMocked}
              onValueChange={(fakeMocked) => s.setFake({ fakeMocked })}
            />
            <SettingsRow
              icon={Timer}
              title={strings.demo.fakeStale}
              subtitle={strings.demo.fakeStaleBody(FAKE_FIX_STALE_AGE_S)}
              value={s.fakeStale}
              onValueChange={(fakeStale) => s.setFake({ fakeStale })}
            />
          </SettingsGroup>
        </>
      ) : null}

      {s.simulatedLocation || (__DEV__ && s.fakeGps) ? (
        <View style={styles.stand}>
          <Text style={typography.overline}>{strings.demo.standAt}</Text>
          <Text style={typography.bodySm}>{strings.demo.standAtBody}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {/* CA1.1: any spot, pinned on the map */}
            <Chip
              label={s.simulatedPoint ? strings.demo.pinnedSpot : strings.demo.pinOnMap}
              selected={s.simulatedPoint !== null}
              onPress={() => router.push('/simulated-pin')}
              accessibilityLabel={strings.demo.pinOnMapLabel}
            />
            {stops.map((stop) => (
              <Chip
                key={stop.code}
                label={stop.code}
                selected={s.simulatedPoint === null && stop.code === standing}
                onPress={() => s.setSimulatedStop(stop.code)}
                accessibilityLabel={`${stop.code}, ${stop.name}`}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <SettingsGroup title={strings.demo.reset}>
        <SettingsRow first icon={RotateCcw} destructive title={strings.demo.resetApp} subtitle={strings.demo.resetAppBody} onPress={confirmReset} />
      </SettingsGroup>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  stand: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
}));

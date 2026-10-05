import { router } from 'expo-router';
import { Bus, MapPin, RotateCcw } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { Chip, Screen, SettingsGroup, SettingsRow } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { signOut } from '@/services/auth';
import { showDialog } from '@/state/dialogStore';
import { resetApp } from '@/state/resetApp';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
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
      </SettingsGroup>

      {s.simulatedLocation ? (
        <View style={styles.stand}>
          <Text style={typography.overline}>{strings.demo.standAt}</Text>
          <Text style={typography.bodySm}>{strings.demo.standAtBody}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {stops.map((stop) => (
              <Chip
                key={stop.code}
                label={stop.code}
                selected={stop.code === s.simulatedStop}
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
    gap: spacing.sm,
  },
}));

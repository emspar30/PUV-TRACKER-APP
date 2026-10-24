import { Bluetooth, BluetoothSearching, Bus } from 'lucide-react-native';
import { Linking, Text, View } from 'react-native';

import { Button, IconTile, LineBadge } from '@/components';
import type { RelayVehicle } from '@/shared/relay/gate';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

import type { BleState, BleView } from './useBleVehicle';

const ICON_SIZE = spacing.md + spacing.xs;

// What Bluetooth is doing, in one line; null when there is nothing to say (no scan in this build)
function lineFor(view: BleView | null): string | null {
  const text = strings.report.ble;
  if (!view) return null;
  switch (view.kind) {
    case 'starting':
    case 'searching':
      return text.searching;
    case 'ambiguous':
      return text.ambiguous;
    case 'failed':
      return text[view.reason];
    case 'unavailable':
      return view.reason === 'not_available' ? null : text[view.reason];
    case 'found':
      return null;
  }
}

type BleCardProps = {
  ble: BleState;
  // The found multicab's route colour
  routeColor: string;
};

type RelayVehicleCardProps = {
  vehicle: RelayVehicle;
  routeColor: string;
  // Found by Bluetooth, or picked by hand in demo data
  demo: boolean;
};

// RL2a (D10): the multicab being relayed: its route number and plate, never the beacon's id
export function RelayVehicleCard({ vehicle, routeColor, demo }: RelayVehicleCardProps) {
  const styles = useStyles();
  const { typography } = useTheme();
  const text = strings.report;
  const { routeCode, plate } = vehicle;
  return (
    <View style={styles.card} accessible accessibilityLabel={demo ? text.demoVehicleLabel(routeCode, plate) : text.bleLabel(routeCode, plate)}>
      <IconTile icon={demo ? Bus : Bluetooth} />
      <View style={styles.grow}>
        <Text style={typography.labelLg}>{demo ? text.demoVehicleTitle : text.bleTitle}</Text>
        <Text style={typography.bodySm}>{demo ? text.demoVehicleBody : text.bleBody}</Text>
      </View>
      <LineBadge code={routeCode} color={routeColor} />
      <Text style={typography.labelLg}>{plate}</Text>
    </View>
  );
}

// DR8: the top of the Relay panel. Found: the route and plate from Bluetooth. Otherwise one line on
// what Bluetooth is doing, or the Nearby devices explainer before the system prompt (PRD 4.2).
// RL2a: there are no manual pickers any more; without a verified multicab the form stays greyed out.
export function BleCard({ ble, routeColor }: BleCardProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { nearby, view } = ble;
  const text = strings.report;

  if (view?.kind === 'found') return <RelayVehicleCard vehicle={view.vehicle} routeColor={routeColor} demo={false} />;

  if (nearby.status === 'explain') {
    return (
      <View style={styles.explainer}>
        <View style={styles.row}>
          <IconTile icon={BluetoothSearching} />
          <Text style={[typography.labelLg, styles.grow]} accessibilityRole="header">
            {text.nearby.title}
          </Text>
        </View>
        <Text style={typography.bodySm}>{text.nearby.body}</Text>
        <View style={styles.row}>
          <View style={styles.grow}>
            <Button label={text.nearby.notNow} variant="secondary" onPress={nearby.decline} />
          </View>
          <View style={styles.grow}>
            <Button label={text.nearby.continue} onPress={() => void nearby.accept()} />
          </View>
        </View>
      </View>
    );
  }

  if (nearby.status === 'declined') return <Button label={text.nearby.useBluetooth} variant="text" leadingIcon={Bluetooth} onPress={nearby.reconsider} />;

  if (nearby.status === 'blocked') {
    return (
      <View style={styles.note}>
        <Text style={typography.bodySm}>{text.nearby.blocked}</Text>
        <Button label={text.nearby.openSettings} variant="text" onPress={() => void Linking.openSettings()} />
      </View>
    );
  }

  const line = nearby.status === 'needs_location' ? text.nearby.needsLocation : nearby.status === 'location_off' ? text.nearby.locationOff : lineFor(view);
  if (!line) return null;
  return (
    <View style={[styles.note, styles.row]}>
      <BluetoothSearching size={ICON_SIZE} color={colors.textSecondary} />
      <Text style={[typography.bodySm, styles.grow]}>{line}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  grow: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  explainer: {
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  note: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
}));

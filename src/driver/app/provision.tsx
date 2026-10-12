import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { parseProvisioning, type DriverProvisioning } from '@/shared/driver/provisioning';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

import { beaconOptions, requestBeaconPermissions } from '../features/beacon/beacon';
import { setupFrom, useDriverStore } from '../state/driverStore';
import { getSupport, isBeaconAvailable, provision, startAdvertising } from '../../../modules/tunton-beacon';

// DR4: setting up a driver phone (PRD 9.5). Scan the setup QR from provision-driver.ts, confirm the
// multicab, grant Nearby devices and notifications, then the phone stores its secrets in the Android
// Keystore (native module) and starts the beacon. The admin checks it from a second phone (DR4-M2).

type Step =
  | { kind: 'scan'; error: string | null }
  | { kind: 'confirm'; payload: DriverProvisioning }
  | { kind: 'permissions'; payload: DriverProvisioning; denied: boolean }
  | { kind: 'starting'; payload: DriverProvisioning }
  | { kind: 'failed'; payload: DriverProvisioning; message: string }
  | { kind: 'done' };

const CAMERA_HEIGHT = 320;
// A rejected code is shown for a moment before the next one is read
const RESCAN_PAUSE_MS = 1500;

export default function Provision() {
  const [step, setStep] = useState<Step>({ kind: 'scan', error: null });
  const [camera, requestCamera] = useCameraPermissions();
  const paused = useRef(false);
  const setSetup = useDriverStore((state) => state.setSetup);
  const setBeaconEnabled = useDriverStore((state) => state.setBeaconEnabled);
  const styles = useStyles();
  const { typography } = useTheme();
  const text = strings.driver.provision;

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (paused.current) return;
    paused.current = true;
    const result = parseProvisioning(data, 'driver', Date.now());
    if (result.ok) {
      setStep({ kind: 'confirm', payload: result.payload });
      return;
    }
    setStep({ kind: 'scan', error: text.invalid[result.reason] });
    setTimeout(() => {
      paused.current = false;
    }, RESCAN_PAUSE_MS);
  };

  const scanAgain = () => {
    paused.current = false;
    setStep({ kind: 'scan', error: null });
  };

  const askPermissions = async (payload: DriverProvisioning) => {
    const granted = await requestBeaconPermissions();
    if (!granted) {
      setStep({ kind: 'permissions', payload, denied: true });
      return;
    }
    setStep({ kind: 'starting', payload });
    await setUp(payload);
  };

  const setUp = async (payload: DriverProvisioning) => {
    const support = getSupport();
    if (!isBeaconAvailable() || !support.bluetooth || support.advertising === false) {
      setStep({ kind: 'failed', payload, message: text.cannotBeacon });
      return;
    }
    if (!support.bluetoothOn) {
      setStep({ kind: 'failed', payload, message: text.bluetoothFirst });
      return;
    }
    try {
      await provision(payload.shortId, payload.beaconSecret, payload.smsKey);
      await startAdvertising(beaconOptions());
      setSetup(setupFrom(payload, Date.now()));
      setBeaconEnabled(true);
      setStep({ kind: 'done' });
    } catch {
      setStep({ kind: 'failed', payload, message: text.failed });
    }
  };

  return (
    <Screen title={text.title}>
      {step.kind === 'scan' ? (
        <>
          <Text style={typography.headlineSm}>{text.scanTitle}</Text>
          {camera?.granted ? (
            <View style={styles.camera}>
              <CameraView style={styles.fill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
            </View>
          ) : (
            <>
              <Text style={typography.bodyLg}>{text.cameraNeeded}</Text>
              <Button label={text.allowCamera} onPress={() => void requestCamera()} />
            </>
          )}
          <Text style={typography.bodyLg}>{step.error ?? text.scanBody}</Text>
        </>
      ) : null}

      {step.kind === 'confirm' ? (
        <>
          <Text style={typography.headlineSm}>{text.confirmTitle}</Text>
          <View style={styles.card}>
            <Text style={typography.display} numberOfLines={1} adjustsFontSizeToFit>
              {step.payload.plate}
            </Text>
            <Text style={typography.headlineMd}>{strings.driver.route(step.payload.routeCode)}</Text>
            <Text style={typography.bodyMd}>{text.vehicle(step.payload.vehicleId)}</Text>
          </View>
          <Text style={typography.bodyLg}>{text.confirmBody}</Text>
          <Button label={text.yes} onPress={() => setStep({ kind: 'permissions', payload: step.payload, denied: false })} />
          <Button label={text.scanAgain} variant="secondary" onPress={scanAgain} />
        </>
      ) : null}

      {step.kind === 'permissions' ? (
        <>
          <Text style={typography.headlineSm}>{text.permissionsTitle}</Text>
          <Text style={typography.bodyLg}>{step.denied ? text.permissionDenied : text.permissionsBody}</Text>
          <Button label={step.denied ? text.tryAgain : text.allow} onPress={() => void askPermissions(step.payload)} />
          {step.denied ? <Button label={text.openSettings} variant="secondary" onPress={() => void Linking.openSettings()} /> : null}
        </>
      ) : null}

      {step.kind === 'starting' ? <Text style={typography.bodyLg}>{text.checking}</Text> : null}

      {step.kind === 'failed' ? (
        <>
          <Text style={typography.headlineSm}>{step.message}</Text>
          <Button label={text.tryAgain} onPress={() => void setUp(step.payload)} />
          <Button label={text.scanAgain} variant="secondary" onPress={scanAgain} />
        </>
      ) : null}

      {step.kind === 'done' ? (
        <>
          <Text style={typography.headlineSm}>{text.doneTitle}</Text>
          <Text style={typography.bodyLg}>{text.doneBody}</Text>
          <Button label={text.done} onPress={() => router.replace('/')} />
        </>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  camera: {
    height: CAMERA_HEIGHT,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  fill: { flex: 1 },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
}));

import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { normalizePhNumber } from '@/shared/driver/phone';
import { parseProvisioning, workerUrlUsable, type GatewayProvisioning } from '@/shared/driver/provisioning';
import { simLabel } from '@/shared/sms/carrier';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import { gatewaySettings } from '../features/service';
import { gatewaySetupFrom, useGatewayStore } from '../state/gatewayStore';
import {
  addSendResultListener,
  canSendSms,
  gatewaySetSim,
  gatewaySetup,
  gatewayStart,
  isIgnoringBatteryOptimizations,
  listSims,
  requestIgnoreBatteryOptimizations,
  sendText,
  type SendResult,
  type SimInfo,
} from '../../../modules/tunton-sms';

// DR7: setting up the gateway phone (PRD 9.6; runbook 11.3), one step per screen: scan the setup code
// from provision-gateway.ts, confirm it, allow SMS, phone and notifications, let it run in the
// background, pick the sending SIM, send a test text (optional), then start the service. The access
// token goes straight into the native module (Android Keystore); only non-secret fields are kept here.

type Step = 'scan' | 'confirm' | 'permissions' | 'battery' | 'sim' | 'test' | 'starting' | 'failed' | 'done';
const NUMBERED: Step[] = ['scan', 'confirm', 'permissions', 'battery', 'sim', 'test'];
const CAMERA_HEIGHT = 320;
const RESCAN_PAUSE_MS = 1500;
const ANDROID_13 = 33;

export default function GatewaySetupScreen() {
  const [step, setStep] = useState<Step>('scan');
  const [payload, setPayload] = useState<GatewayProvisioning | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [smsDenied, setSmsDenied] = useState(false);
  const [unrestricted, setUnrestricted] = useState(isIgnoringBatteryOptimizations);
  const [sims, setSims] = useState<SimInfo[]>([]);
  const [sim, setSim] = useState<number | null>(null);
  const [testTo, setTestTo] = useState('');
  const [test, setTest] = useState<{ id: string | null; sent?: SendResult; delivered?: SendResult; error?: string } | null>(null);
  const [camera, requestCamera] = useCameraPermissions();
  const paused = useRef(false);
  const setSetup = useGatewayStore((state) => state.setSetup);
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const text = strings.gateway.setup;

  // Back from Android's battery prompt or settings: look again
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setUnrestricted(isIgnoringBatteryOptimizations());
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = addSendResultListener((result) => {
      setTest((current) => (current && current.id === result.id ? { ...current, [result.stage]: result } : current));
    });
    return () => subscription?.remove();
  }, []);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (paused.current) return;
    paused.current = true;
    const result = parseProvisioning(data, 'gateway', Date.now());
    const reason = !result.ok ? text.invalid[result.reason] : !workerUrlUsable(result.payload.workerUrl, __DEV__) ? text.httpInRelease : null;
    if (result.ok && reason === null) {
      setPayload(result.payload);
      setStep('confirm');
      return;
    }
    setScanError(reason);
    setTimeout(() => {
      paused.current = false;
    }, RESCAN_PAUSE_MS);
  };

  const scanAgain = () => {
    paused.current = false;
    setPayload(null);
    setScanError(null);
    setStep('scan');
  };

  const askPermissions = async () => {
    const wanted = [PermissionsAndroid.PERMISSIONS.SEND_SMS, PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE];
    const version = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
    if (version >= ANDROID_13) wanted.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    await PermissionsAndroid.requestMultiple(wanted);
    if (!canSendSms()) {
      setSmsDenied(true);
      return;
    }
    setSmsDenied(false);
    // The SIM must be chosen (no "phone default"); with one SIM there is nothing to choose
    const found = listSims();
    setSims(found);
    setSim(found.length === 1 ? found[0].subscriptionId : null);
    setStep(isIgnoringBatteryOptimizations() ? 'sim' : 'battery');
  };

  const sendTest = async () => {
    const to = normalizePhNumber(testTo);
    if (!to) return;
    try {
      const id = await sendText(to, text.testText, sim);
      setTest({ id });
    } catch (error) {
      setTest({ id: null, error: error instanceof Error ? error.message : String(error) });
    }
  };

  const start = async () => {
    if (!payload) return;
    setStep('starting');
    try {
      await gatewaySetup(payload.gatewayId, payload.workerUrl, payload.token);
      gatewaySetSim(sim);
      await gatewayStart(gatewaySettings());
      setSetup(gatewaySetupFrom(payload, Date.now()));
      setStep('done');
    } catch {
      setStep('failed');
    }
  };

  const describe = (result: SendResult | undefined) => (result ? (result.ok ? '✓' : `✗ ${result.errorCode ?? result.status ?? result.resultCode}`) : text.waiting);
  const index = NUMBERED.indexOf(step);

  return (
    <Screen title={text.title}>
      {index >= 0 ? <Text style={[typography.overline, styles.overline]}>{text.step(index + 1, NUMBERED.length)}</Text> : null}

      {step === 'scan' ? (
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
          <Text style={[typography.bodyLg, scanError ? { color: colors.danger } : null]}>{scanError ?? text.scanBody}</Text>
        </>
      ) : null}

      {step === 'confirm' && payload ? (
        <>
          <Text style={typography.headlineSm}>{text.confirmTitle}</Text>
          <View style={styles.card}>
            <Text style={typography.headlineMd}>{payload.gatewayId}</Text>
            <Text style={typography.bodyMd} selectable>
              {text.confirmBody(payload.gatewayId, payload.workerUrl)}
            </Text>
          </View>
          <Button label={text.yes} onPress={() => setStep('permissions')} />
          <Button label={text.scanAgain} variant="secondary" onPress={scanAgain} />
        </>
      ) : null}

      {step === 'permissions' ? (
        <>
          <Text style={typography.headlineSm}>{text.permissionsTitle}</Text>
          <Text style={[typography.bodyLg, smsDenied ? { color: colors.danger } : null]}>{smsDenied ? text.smsDenied : text.permissionsBody}</Text>
          <Button label={smsDenied ? text.tryAgain : text.allow} onPress={() => void askPermissions()} />
          {smsDenied ? <Button label={text.openSettings} variant="secondary" onPress={() => void Linking.openSettings()} /> : null}
        </>
      ) : null}

      {step === 'battery' ? (
        <>
          <Text style={typography.headlineSm}>{text.batteryTitle}</Text>
          <Text style={typography.bodyLg}>{unrestricted ? text.batteryDone : text.batteryBody}</Text>
          {unrestricted ? null : <Button label={strings.gateway.home.allowBackground} onPress={requestIgnoreBatteryOptimizations} />}
          <Button label={text.continue} variant={unrestricted ? 'primary' : 'secondary'} onPress={() => setStep('sim')} />
        </>
      ) : null}

      {step === 'sim' ? (
        <>
          <Text style={typography.headlineSm}>{text.simTitle}</Text>
          <Text style={typography.bodyLg}>{text.simBody}</Text>
          {sims.length === 0 ? <Text style={typography.bodyMd}>{text.simNone}</Text> : null}
          <View style={styles.chips}>
            {sims.map((info) => {
              const { slot, network } = simLabel(info);
              return (
                <Choice
                  key={info.subscriptionId}
                  label={strings.gateway.simName(slot, network)}
                  on={sim === info.subscriptionId}
                  onPress={() => setSim(info.subscriptionId)}
                />
              );
            })}
          </View>
          <Button label={text.continue} onPress={() => setStep('test')} disabled={sims.length > 0 && sim === null} />
        </>
      ) : null}

      {step === 'test' ? (
        <>
          <Text style={typography.headlineSm}>{text.testTitle}</Text>
          <Text style={typography.bodyLg}>{text.testBody}</Text>
          <TextInput
            style={[typography.bodyLg, styles.input]}
            value={testTo}
            onChangeText={setTestTo}
            keyboardType="phone-pad"
            placeholder="09XX XXX XXXX"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={text.testNumber}
          />
          <Button label={text.sendTest} variant="secondary" onPress={() => void sendTest()} disabled={!normalizePhNumber(testTo)} />
          {test ? (
            <Text style={[typography.bodyMd, test.error ? { color: colors.danger } : null]}>
              {test.error ?? text.testResult(describe(test.sent), describe(test.delivered))}
            </Text>
          ) : null}
          <Button label={strings.gateway.home.start} onPress={() => void start()} />
          {test ? null : <Button label={text.skip} variant="text" onPress={() => void start()} />}
        </>
      ) : null}

      {step === 'starting' ? <Text style={typography.bodyLg}>{text.starting}</Text> : null}

      {step === 'failed' ? (
        <>
          <Text style={[typography.headlineSm, { color: colors.danger }]}>{text.failed}</Text>
          <Button label={text.tryAgain} onPress={() => void start()} />
          <Button label={text.scanAgain} variant="secondary" onPress={scanAgain} />
        </>
      ) : null}

      {step === 'done' ? (
        <>
          <Text style={typography.headlineSm}>{text.doneTitle}</Text>
          <Text style={typography.bodyLg}>{text.doneBody}</Text>
          <Button label={text.done} onPress={() => router.replace('/')} />
        </>
      ) : null}
    </Screen>
  );
}

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <Pressable style={[styles.chip, on && { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer }]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[typography.labelLg, on && { color: colors.onPrimaryContainer }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  overline: { marginBottom: -spacing.xs },
  // No clipping and no fill: on Android they hide the camera's SurfaceView (a blank box, 2026-10-13)
  camera: { height: CAMERA_HEIGHT },
  fill: { flex: 1 },
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: radii.card, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.textPrimary,
  },
}));

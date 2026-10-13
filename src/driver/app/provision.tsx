import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import {
  ArrowRight,
  Bell,
  Bluetooth,
  Camera,
  Check,
  CircleAlert,
  CircleCheckBig,
  EllipsisVertical,
  MessageSquare,
  RotateCcw,
  ScanQrCode,
  Settings,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { OptionRow } from '@/components/OptionRow';
import { LineBadge } from '@/components/Pills';
import { StepHeader } from '@/components/StepHeader';
import { parseProvisioning, type DriverProvisioning } from '@/shared/driver/provisioning';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

import { Notice } from '../components/Notice';
import { beaconOptions, requestBeaconPermissions } from '../features/beacon/beacon';
import { ensureInboxConfigured } from '../features/heatmap/inbox';
import { driverRoute } from '../features/heatmap/routeStops';
import { requestSmsPermission } from '../features/heatmap/smsPermission';
import { setupFrom, useDriverStore } from '../state/driverStore';
import { getSupport, isBeaconAvailable, provision, startAdvertising } from '../../../modules/tunton-beacon';

// DR4: setting up a driver phone (PRD 9.5). Scan the setup QR from provision-driver.ts, confirm the
// multicab, grant Nearby devices and notifications, then text messages (DR5), then the phone stores
// its secrets in the Android Keystore (native module), starts the beacon and turns its SMS inbox on.
// The admin checks the beacon from a second phone (DR4-M2). Text messages can be skipped (the beacon
// works without them) and allowed later from the admin screen; the home screen says they are off.
// Look: the Stitch designs 3.6 to 3.10 (docs/DRIVER_UI_PRD.md) in the commuter app's style: its step
// header ("STEP 2 OF 5" over a segmented bar), option rows with icon tiles, and the buttons at the
// bottom of the screen. The back arrow goes to the step before until the setup starts.

type Step =
  | { kind: 'scan'; error: string | null }
  | { kind: 'confirm'; payload: DriverProvisioning }
  | { kind: 'permissions'; payload: DriverProvisioning; denied: boolean }
  | { kind: 'sms'; payload: DriverProvisioning; denied: boolean }
  | { kind: 'starting'; payload: DriverProvisioning }
  | { kind: 'failed'; payload: DriverProvisioning; message: string }
  | { kind: 'done' };

const STEP_NUMBER: Record<Step['kind'], number> = { scan: 1, confirm: 2, permissions: 3, sms: 4, starting: 5, failed: 5, done: 5 };
const STEP_COUNT = 5;

const CAMERA_HEIGHT = 320;
// The square the QR code is aimed at, and its corner marks
const FRAME_SIZE = 200;
const CORNER_SIZE = spacing.xl;
const CORNER_WIDTH = spacing.xs;
const CAMERA_ICON = spacing.xl;
const DONE_MARK = spacing.xl * 3;
const DONE_ICON = spacing.xl + spacing.md;
const FIX_ICON = spacing.md + spacing.xs;
const FIX_NUMBER = spacing.lg + spacing.xs;
// A rejected code is shown for a moment before the next one is read
const RESCAN_PAUSE_MS = 1500;

// Where the back arrow goes: the step before, while nothing has been saved yet
function previousStep(step: Step): Step | null {
  if (step.kind === 'confirm') return { kind: 'scan', error: null };
  if (step.kind === 'permissions') return { kind: 'confirm', payload: step.payload };
  if (step.kind === 'sms') return { kind: 'permissions', payload: step.payload, denied: false };
  return null;
}

export default function Provision() {
  const [step, setStep] = useState<Step>({ kind: 'scan', error: null });
  const [camera, requestCamera, getCamera] = useCameraPermissions();
  const paused = useRef(false);
  const setSetup = useDriverStore((state) => state.setSetup);
  const setBeaconEnabled = useDriverStore((state) => state.setBeaconEnabled);
  const styles = useStyles();
  const { colors, typography, routeColor } = useTheme();
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

  // Back from Android's settings (the camera allowed there): look again
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') getCamera().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [getCamera]);

  // Once the camera was refused for good, Android shows no prompt: only its settings can allow it
  const cameraBlocked = camera !== null && !camera.granted && !camera.canAskAgain;

  const askPermissions = async (payload: DriverProvisioning) => {
    const granted = await requestBeaconPermissions();
    if (!granted) {
      setStep({ kind: 'permissions', payload, denied: true });
      return;
    }
    setStep({ kind: 'sms', payload, denied: false });
  };

  const askSms = async (payload: DriverProvisioning) => {
    if (!(await requestSmsPermission())) {
      setStep({ kind: 'sms', payload, denied: true });
      return;
    }
    await startSetUp(payload);
  };

  const startSetUp = async (payload: DriverProvisioning) => {
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
      await ensureInboxConfigured();
      setSetup(setupFrom(payload, Date.now()));
      setBeaconEnabled(true);
      setStep({ kind: 'done' });
    } catch {
      setStep({ kind: 'failed', payload, message: text.failed });
    }
  };

  const previous = previousStep(step);
  const goBack = previous
    ? () => {
        paused.current = false;
        setStep(previous);
      }
    : undefined;

  let body: ReactNode = null;
  let actions: ReactNode = null;
  switch (step.kind) {
    case 'scan':
      body = (
        <>
          <Intro title={text.scanTitle} body={text.scanBody} />
          {camera?.granted ? (
            <View style={styles.cameraLive}>
              <CameraView style={styles.fill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
              <Viewfinder />
            </View>
          ) : (
            <View style={[styles.camera, styles.cameraOff]}>
              <Camera color={colors.textSecondary} size={CAMERA_ICON} />
              <Text style={[typography.bodyLg, styles.center]}>{cameraBlocked ? text.cameraBlocked : text.cameraNeeded}</Text>
            </View>
          )}
          {step.error ? <Notice tone="danger" icon={CircleAlert} title={step.error} /> : null}
        </>
      );
      actions = camera?.granted ? null : cameraBlocked ? (
        <Button label={text.openSettings} leadingIcon={Settings} onPress={() => void Linking.openSettings()} />
      ) : (
        <Button label={text.allowCamera} leadingIcon={Camera} onPress={() => void requestCamera()} />
      );
      break;

    case 'confirm': {
      const { payload } = step;
      const route = driverRoute(payload.routeCode);
      const badgeColor = routeColor(payload.routeCode, route.color);
      body = (
        <>
          <Intro title={text.confirmTitle} body={text.confirmBody} />
          <Card>
            <View style={styles.plate}>
              <Text style={[typography.labelSm, styles.caps]}>{strings.driver.vehiclePlate}</Text>
              <Text style={[typography.display, styles.plateText]} numberOfLines={1} adjustsFontSizeToFit>
                {payload.plate}
              </Text>
            </View>
            <View style={styles.routeRow}>
              {badgeColor ? <LineBadge code={payload.routeCode} color={badgeColor} /> : null}
              <View style={styles.grow}>
                <Text style={typography.headlineSm}>{strings.driver.route(payload.routeCode)}</Text>
                {route.name ? <Text style={typography.bodySm}>{route.name}</Text> : null}
              </View>
              <Text style={typography.bodySm}>{text.vehicle(payload.vehicleId)}</Text>
            </View>
          </Card>
        </>
      );
      actions = (
        <>
          <Button label={text.yes} leadingIcon={Check} onPress={() => setStep({ kind: 'permissions', payload, denied: false })} />
          <Button label={text.scanAgain} leadingIcon={ScanQrCode} variant="secondary" onPress={scanAgain} />
        </>
      );
      break;
    }

    case 'permissions': {
      const { payload } = step;
      body = (
        <>
          <Intro title={text.permissionsTitle} />
          <OptionRow icon={Bluetooth} title={text.nearbyTitle} subtitle={text.nearbyBody} />
          <OptionRow icon={Bell} title={text.notificationsTitle} subtitle={text.notificationsBody} />
          {step.denied ? <Notice tone="danger" icon={CircleAlert} title={text.permissionDenied} /> : null}
        </>
      );
      actions = step.denied ? (
        <>
          <Button label={text.tryAgain} leadingIcon={RotateCcw} onPress={() => void askPermissions(payload)} />
          <Button label={text.openSettings} leadingIcon={Settings} variant="secondary" onPress={() => void Linking.openSettings()} />
        </>
      ) : (
        <Button label={text.allow} icon={ArrowRight} onPress={() => void askPermissions(payload)} />
      );
      break;
    }

    case 'sms': {
      const { payload } = step;
      body = (
        <>
          <Intro title={text.smsTitle} />
          <OptionRow icon={MessageSquare} title={text.smsWhy} subtitle={text.smsPrivacy} />
          {step.denied ? (
            <Notice tone="warning" icon={TriangleAlert} title={text.smsDeniedTitle} body={text.smsRestricted}>
              <View style={styles.fixSteps}>
                <FixStep number={1} icon={Settings} text={text.smsSteps.open} />
                <FixStep number={2} icon={EllipsisVertical} text={text.smsSteps.allow} />
                <FixStep number={3} icon={RotateCcw} text={text.smsSteps.back} />
              </View>
            </Notice>
          ) : null}
        </>
      );
      actions = step.denied ? (
        <>
          <Button label={text.tryAgain} leadingIcon={RotateCcw} onPress={() => void askSms(payload)} />
          <Button label={text.openSettings} leadingIcon={Settings} variant="secondary" onPress={() => void Linking.openSettings()} />
          <Button label={text.smsSkip} variant="text" onPress={() => void startSetUp(payload)} />
        </>
      ) : (
        <Button label={text.smsAllow} icon={ArrowRight} onPress={() => void askSms(payload)} />
      );
      break;
    }

    case 'starting':
      body = (
        <Card style={styles.checking}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={typography.headlineSm}>{text.checking}</Text>
        </Card>
      );
      break;

    case 'failed': {
      const { payload } = step;
      body = <Notice tone="danger" icon={CircleAlert} title={step.message} />;
      actions = (
        <>
          <Button label={text.tryAgain} leadingIcon={RotateCcw} onPress={() => void startSetUp(payload)} />
          <Button label={text.scanAgain} leadingIcon={ScanQrCode} variant="secondary" onPress={scanAgain} />
        </>
      );
      break;
    }

    case 'done':
      body = (
        <Card style={styles.done}>
          <View style={styles.doneMark}>
            <CircleCheckBig color={colors.success} size={DONE_ICON} />
          </View>
          <Text style={[typography.headlineLg, styles.center]} accessibilityRole="header">
            {text.doneTitle}
          </Text>
          <Text style={[typography.bodyLg, styles.center]}>{text.doneBody}</Text>
        </Card>
      );
      actions = <Button label={text.done} onPress={() => router.replace('/')} />;
      break;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <StepHeader title={text.title} onBack={goBack} step={{ current: STEP_NUMBER[step.kind], total: STEP_COUNT }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </SafeAreaView>
  );
}

// The step's heading, and a line under it
function Intro({ title, body }: { title: string; body?: string }) {
  const styles = useStyles();
  const { typography } = useTheme();
  return (
    <View style={styles.intro}>
      <Text style={typography.headlineLg} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[typography.bodyLg, styles.muted]}>{body}</Text> : null}
    </View>
  );
}

// Corner marks over the camera, around the square the code is aimed at
function Viewfinder() {
  const styles = useStyles();
  return (
    <View style={styles.frameWrap} pointerEvents="none">
      <View style={styles.frame}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </View>
    </View>
  );
}

// One step of the restricted-setting fix (Stitch 3.9)
function FixStep({ number, icon: Icon, text }: { number: number; icon: LucideIcon; text: string }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={styles.fixStep}>
      <View style={styles.fixNumber}>
        <Text style={typography.labelLg}>{number}</Text>
      </View>
      <Icon color={colors.textSecondary} size={FIX_ICON} />
      <Text style={[typography.bodyMd, styles.grow]}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  intro: {
    gap: spacing.xs,
  },
  muted: {
    color: colors.textSecondary,
  },
  center: {
    textAlign: 'center',
  },
  grow: {
    flex: 1,
  },
  caps: {
    textTransform: 'uppercase',
  },
  camera: {
    height: CAMERA_HEIGHT,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  // The live camera: no clipping and no fill: on Android they hide the camera's SurfaceView (a blank
  // box on a Xiaomi, Android 16, 2026-10-13)
  cameraLive: {
    height: CAMERA_HEIGHT,
  },
  cameraOff: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm + spacing.xs,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  fill: { flex: 1 },
  frameWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  },
  // White over the camera picture (the driver app is light only)
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: colors.card,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: radii.md,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: radii.md,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: radii.md,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: radii.md,
  },
  plate: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  plateText: {
    fontWeight: '700',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  checking: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  done: {
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingVertical: spacing.lg,
  },
  doneMark: {
    width: DONE_MARK,
    height: DONE_MARK,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DONE_MARK,
    backgroundColor: colors.successContainer,
  },
  fixSteps: {
    gap: spacing.sm,
  },
  fixStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  fixNumber: {
    width: FIX_NUMBER,
    height: FIX_NUMBER,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: FIX_NUMBER,
    backgroundColor: colors.surfaceHigh,
  },
}));

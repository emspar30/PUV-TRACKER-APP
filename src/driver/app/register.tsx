import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import {
  ArrowRight,
  Bell,
  Bluetooth,
  Bus,
  Camera,
  CircleAlert,
  CircleCheckBig,
  Clock,
  EllipsisVertical,
  IdCard,
  MessageSquare,
  Pencil,
  RotateCcw,
  ScanQrCode,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Wifi,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { OptionRow } from '@/components/OptionRow';
import { LineBadge } from '@/components/Pills';
import { StepHeader } from '@/components/StepHeader';
import { REGISTRATION_PHOTO_QUALITY, REGISTRATION_STATUS_POLL_S } from '@/shared/config';
import { normalizePhNumber } from '@/shared/driver/phone';
import { normalizePlate } from '@/shared/driver/registration';
import { checkFresh, mayCollect, mustRegisterAgain, pickPictureSize, resumeStep, waitingStatus, type WaitingStatus } from '@/shared/driver/registrationFlow';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, radii, spacing, useTheme } from '@/theme';

import { Notice } from '../components/Notice';
import { requestBeaconPermissions } from '../features/beacon/beacon';
import { ensureInboxConfigured } from '../features/heatmap/inbox';
import { driverRoute, driverRouteCodes } from '../features/heatmap/routeStops';
import { requestSmsPermission } from '../features/heatmap/smsPermission';
import { collectSetup, registrationStatus, startRegistration, submitRegistration } from '../features/registration/api';
import { uploadPhoto } from '../features/registration/device';
import { applySetup, setupBlock } from '../features/setup/applySetup';
import { useRegistrationStore } from '../state/registrationStore';

// DRG4: registering this driver phone (PRD 9.5; docs/IMPLEMENTATION_PLAN_DRIVER_REGISTRATION.md). The
// driver allows Nearby devices, notifications and text messages first (the number check arrives by
// text), gives the number (the check is read from the inbox by itself), the plate and route, and
// two photos, then waits for an admin. Once approved, the app collects its setup, once, and sets the
// phone up as the QR did. What is done is remembered (registrationStore), so a restart picks up there.
// The setup QR stays available ("Use a setup code") for development and testing.

type Photo = 'id' | 'vehicle';

type Step =
  | { kind: 'welcome' }
  | { kind: 'permissions'; denied: 'nearby' | 'sms' | null }
  | { kind: 'number' }
  | { kind: 'vehicle' }
  | { kind: 'photos' }
  | { kind: 'review' }
  | { kind: 'waiting' }
  | { kind: 'done' };

const STEP_NUMBER: Record<Step['kind'], number> = { welcome: 1, permissions: 2, number: 3, vehicle: 4, photos: 5, review: 6, waiting: 7, done: 7 };
const STEP_COUNT = 7;
const CAMERA_HEIGHT = 360;
const THUMB_SIZE = spacing.xl * 3;
const DONE_MARK = spacing.xl * 3;
const DONE_ICON = spacing.xl + spacing.md;
const FIX_ICON = spacing.md + spacing.xs;
const FIX_NUMBER = spacing.lg + spacing.xs;
const ICON_SIZE = spacing.lg;
const EDIT_ICON = spacing.md;
const MS_PER_S = 1000;

const errorText = (error: string) => strings.driver.register.errors[error] ?? strings.driver.register.errors.unknown;

export default function Register() {
  const progress = useRegistrationStore();
  const [step, setStep] = useState<Step>(() => {
    const resumed = resumeStep(useRegistrationStore.getState(), Date.now());
    return resumed === 'welcome' ? { kind: 'welcome' } : { kind: resumed };
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const text = strings.driver.register;

  const go = (next: Step) => {
    setError(null);
    setBusy(false);
    setStep(next);
  };

  // After the number, the plate and route, or the photos: the first step still to do, so an edit from
  // "Check and send" comes back to it, and a new number goes on to new photos
  const goOn = () => go({ kind: resumeStep(useRegistrationStore.getState(), Date.now()) });

  const previous: Step | null =
    step.kind === 'permissions' ? { kind: 'welcome' } : step.kind === 'photos' ? { kind: 'vehicle' } : step.kind === 'review' ? { kind: 'photos' } : null;

  let body: ReactNode = null;
  let actions: ReactNode = null;
  switch (step.kind) {
    case 'welcome':
      body = (
        <>
          <Intro title={text.welcomeTitle} body={text.welcomeBody} />
          <Text style={[typography.labelSm, styles.caps]}>{text.needTitle}</Text>
          <OptionRow icon={Wifi} title={text.needInternet} />
          <OptionRow icon={IdCard} title={text.needId} />
          <OptionRow icon={Bus} title={text.needVehicle} />
          {error ? <Notice tone="danger" icon={CircleAlert} title={error} /> : null}
        </>
      );
      actions = (
        <>
          <Button label={text.start} icon={ArrowRight} onPress={() => go({ kind: 'permissions', denied: null })} />
          <Button label={text.useCode} leadingIcon={ScanQrCode} variant="text" onPress={() => router.push('/provision')} />
        </>
      );
      break;

    case 'permissions':
      body = <PermissionsBody denied={step.denied} />;
      actions = (
        <PermissionsActions
          denied={step.denied}
          onAllow={async () => {
            if (!(await requestBeaconPermissions())) return go({ kind: 'permissions', denied: 'nearby' });
            if (!(await requestSmsPermission())) return go({ kind: 'permissions', denied: 'sms' });
            await ensureInboxConfigured().catch(() => undefined);
            go({ kind: 'number' });
          }}
        />
      );
      break;

    case 'number':
      body = <NumberStep onChecked={goOn} />;
      break;

    case 'vehicle':
      body = <VehicleStep onDone={goOn} />;
      break;

    case 'photos':
      body = <PhotosStep onDone={goOn} onExpired={() => go({ kind: 'welcome' })} />;
      break;

    case 'review': {
      const route = progress.route ? driverRoute(progress.route) : null;
      body = (
        <>
          <Intro title={text.reviewTitle} />
          <Card>
            <Row label={text.reviewNumber} value={progress.phone ?? ''} onEdit={() => go({ kind: 'number' })} />
            <Row label={text.reviewPlate} value={progress.plate ?? ''} onEdit={() => go({ kind: 'vehicle' })} />
            <Row label={text.reviewRoute} value={route ? `${strings.driver.route(route.routeCode)} · ${route.name}` : ''} onEdit={() => go({ kind: 'vehicle' })} />
            <Row label={text.reviewPhotos} value={text.reviewPhotosSent} onEdit={() => go({ kind: 'photos' })} />
          </Card>
          {error ? <Notice tone="danger" icon={CircleAlert} title={error} /> : null}
        </>
      );
      actions = (
        <Button
          label={busy ? text.sending : text.submit}
          leadingIcon={Send}
          disabled={busy}
          onPress={async () => {
            if (!progress.check || !progress.plate || !progress.route) return go({ kind: 'welcome' });
            setBusy(true);
            const result = await submitRegistration(progress.check, progress.plate, progress.route);
            setBusy(false);
            if (result.ok) {
              useRegistrationStore.getState().setToken(result.token);
              go({ kind: 'waiting' });
              return;
            }
            if (result.error === 'photos_missing') return go({ kind: 'photos' });
            if (result.error === 'check_not_verified') {
              // Over an hour since the number check: start again, saying why
              useRegistrationStore.getState().resetRegistration();
              setStep({ kind: 'welcome' });
            }
            setError(errorText(result.error));
          }}
        />
      );
      break;
    }

    case 'waiting':
      body = <WaitingStep onDone={() => go({ kind: 'done' })} onAgain={() => go({ kind: 'welcome' })} />;
      break;

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
      <StepHeader title={text.title} onBack={previous ? () => go(previous) : undefined} step={{ current: STEP_NUMBER[step.kind], total: STEP_COUNT }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </SafeAreaView>
  );
}

// --- Permissions (before the number: the check arrives by text)

function PermissionsBody({ denied }: { denied: 'nearby' | 'sms' | null }) {
  const styles = useStyles();
  const text = strings.driver.register;
  const setupText = strings.driver.provision;
  return (
    <>
      <Intro title={text.permissionsTitle} body={text.permissionsBody} />
      <OptionRow icon={Bluetooth} title={setupText.nearbyTitle} subtitle={setupText.nearbyBody} />
      <OptionRow icon={Bell} title={setupText.notificationsTitle} subtitle={setupText.notificationsBody} />
      <OptionRow icon={MessageSquare} title={setupText.smsWhy} subtitle={setupText.smsPrivacy} />
      {denied === 'nearby' ? <Notice tone="danger" icon={CircleAlert} title={setupText.permissionDenied} /> : null}
      {denied === 'sms' ? (
        <Notice tone="warning" icon={TriangleAlert} title={setupText.smsDeniedTitle} body={setupText.smsRestricted}>
          <View style={styles.fixSteps}>
            <FixStep number={1} icon={Settings} text={setupText.smsSteps.open} />
            <FixStep number={2} icon={EllipsisVertical} text={setupText.smsSteps.allow} />
            <FixStep number={3} icon={RotateCcw} text={setupText.smsSteps.back} />
          </View>
        </Notice>
      ) : null}
    </>
  );
}

function PermissionsActions({ denied, onAllow }: { denied: 'nearby' | 'sms' | null; onAllow: () => Promise<void> }) {
  const setupText = strings.driver.provision;
  if (!denied) return <Button label={setupText.allow} icon={ArrowRight} onPress={() => void onAllow()} />;
  return (
    <>
      <Button label={setupText.tryAgain} leadingIcon={RotateCcw} onPress={() => void onAllow()} />
      <Button label={setupText.openSettings} leadingIcon={Settings} variant="secondary" onPress={() => void Linking.openSettings()} />
    </>
  );
}

// --- The number, as typed (no SMS checks it: owner decision, 2026-10-28)

function NumberStep({ onChecked }: { onChecked: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const text = strings.driver.register;
  const [number, setNumber] = useState(useRegistrationStore.getState().phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = async () => {
    const target = normalizePhNumber(number);
    if (!target) return setError(errorText('invalid_number'));
    // The same number entered less than an hour ago: keep that start (each start counts against the
    // daily limits)
    const saved = useRegistrationStore.getState();
    if (saved.phone === target && checkFresh(saved, Date.now())) return onChecked();
    setBusy(true);
    setError(null);
    const result = await startRegistration(target);
    setBusy(false);
    if (!result.ok) return setError(errorText(result.error));
    useRegistrationStore.getState().setChecked(target, result.check, result.uploads, Date.now());
    onChecked();
  };

  // Editing from "Check and send": a different number opens a new entry, and the photos sent belong to
  // the old one
  const saved = useRegistrationStore.getState();
  const photosLost = (saved.uploaded.id || saved.uploaded.vehicle) && normalizePhNumber(number) !== saved.phone;

  return (
    <>
      <Intro title={text.numberTitle} body={text.numberBody} />
      <View style={styles.input}>
        <Smartphone color={colors.textSecondary} size={ICON_SIZE} />
        <TextInput
          style={[typography.bodyLg, styles.inputText]}
          value={number}
          onChangeText={setNumber}
          placeholder={text.numberPlaceholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="phone-pad"
          autoComplete="tel"
          accessibilityLabel={text.numberTitle}
        />
      </View>
      {photosLost ? <Notice tone="warning" icon={Camera} title={text.newNumberPhotos} /> : null}
      {error ? <Notice tone="danger" icon={CircleAlert} title={error} /> : null}
      <Button label={busy ? text.numberSaving : text.next} icon={ArrowRight} disabled={busy} onPress={() => void next()} />
    </>
  );
}

// --- Plate and route

function VehicleStep({ onDone }: { onDone: () => void }) {
  const styles = useStyles();
  const { colors, typography, routeColor } = useTheme();
  const text = strings.driver.register;
  const saved = useRegistrationStore.getState();
  const [plate, setPlate] = useState(saved.plate ?? '');
  const [route, setRoute] = useState<string | null>(saved.route);
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    const normal = normalizePlate(plate);
    if (!normal) return setError(text.plateInvalid);
    if (!route) return setError(errorText('invalid_route'));
    useRegistrationStore.getState().setVehicle(normal, route);
    onDone();
  };

  return (
    <>
      <Intro title={text.vehicleTitle} />
      <Text style={[typography.labelSm, styles.caps]}>{text.plateLabel}</Text>
      <View style={styles.input}>
        <TextInput
          style={[typography.headlineSm, styles.inputText]}
          value={plate}
          onChangeText={setPlate}
          placeholder={text.platePlaceholder}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel={text.plateLabel}
        />
      </View>
      <Text style={[typography.labelSm, styles.caps]}>{text.routeLabel}</Text>
      {driverRouteCodes().map((code) => {
        const info = driverRoute(code);
        const color = routeColor(code, info.color);
        return (
          <OptionRow
            key={code}
            title={info.name || strings.driver.route(code)}
            trailing={color ? <LineBadge code={code} color={color} /> : undefined}
            selected={route === code}
            onPress={() => setRoute(code)}
          />
        );
      })}
      {error ? <Notice tone="danger" icon={CircleAlert} title={error} /> : null}
      <Button label={text.next} icon={ArrowRight} onPress={next} />
    </>
  );
}

// --- The two photos: each taken, then sent at once to its upload link

function PhotosStep({ onDone, onExpired }: { onDone: () => void; onExpired: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const text = strings.driver.register;
  const progress = useRegistrationStore();
  const [camera, requestCamera, getCamera] = useCameraPermissions();
  const [taking, setTaking] = useState<Photo | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<Photo, string>>>({});
  const [sending, setSending] = useState<Photo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<string | undefined>(undefined);
  const view = useRef<CameraView>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') getCamera().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [getCamera]);

  const capture = async (which: Photo) => {
    const uploads = useRegistrationStore.getState().uploads;
    if (!uploads) return onExpired();
    const picture = await view.current?.takePictureAsync({ quality: REGISTRATION_PHOTO_QUALITY, shutterSound: false }).catch(() => undefined);
    if (!picture) return;
    setTaking(null);
    setPreviews((current) => ({ ...current, [which]: picture.uri }));
    setSending(which);
    setError(null);
    const outcome = await uploadPhoto(picture.uri, uploads[which]);
    setSending(null);
    if (outcome === 'ok') useRegistrationStore.getState().setUploaded(which);
    else setError(errorText(outcome === 'too_big' ? 'too_big' : outcome === 'offline' ? 'offline' : 'upload_failed'));
  };

  const cameraBlocked = camera !== null && !camera.granted && !camera.canAskAgain;

  if (taking) {
    return (
      <>
        <Intro title={taking === 'id' ? text.photoId : text.photoVehicle} body={taking === 'id' ? text.photoIdHint : text.photoVehicleHint} />
        {camera?.granted ? (
          <View style={styles.cameraLive}>
            <CameraView
              ref={view}
              style={styles.fill}
              facing="back"
              pictureSize={size}
              onCameraReady={() => {
                view.current
                  ?.getAvailablePictureSizesAsync()
                  .then((sizes) => setSize(pickPictureSize(sizes) ?? undefined))
                  .catch(() => undefined);
              }}
            />
          </View>
        ) : (
          <Card style={styles.checking}>
            <Camera color={colors.textSecondary} size={ICON_SIZE} />
            <Text style={[typography.bodyLg, styles.center]}>{cameraBlocked ? text.cameraBlocked : text.cameraNeeded}</Text>
          </Card>
        )}
        {camera?.granted ? (
          <Button label={text.capture} leadingIcon={Camera} onPress={() => void capture(taking)} />
        ) : cameraBlocked ? (
          <Button label={strings.driver.provision.openSettings} leadingIcon={Settings} onPress={() => void Linking.openSettings()} />
        ) : (
          <Button label={text.allowCamera} leadingIcon={Camera} onPress={() => void requestCamera()} />
        )}
        <Button label={text.cancel} variant="text" onPress={() => setTaking(null)} />
      </>
    );
  }

  const photoRow = (which: Photo, title: string, hint: string, icon: LucideIcon) => {
    const done = progress.uploaded[which];
    return (
      <OptionRow
        key={which}
        icon={icon}
        title={title}
        subtitle={sending === which ? text.uploading : done ? text.uploaded : hint}
        trailing={
          sending === which ? (
            <ActivityIndicator color={colors.primary} />
          ) : previews[which] ? (
            <Image source={{ uri: previews[which] }} style={styles.thumb} />
          ) : undefined
        }
        below={
          <Button label={done || previews[which] ? text.retake : text.takePhoto} leadingIcon={Camera} variant="secondary" disabled={sending !== null} onPress={() => setTaking(which)} />
        }
      />
    );
  };

  return (
    <>
      <Intro title={text.photosTitle} />
      <OptionRow icon={ShieldCheck} title={text.consentTitle} subtitle={text.consentBody} />
      {photoRow('id', text.photoId, text.photoIdHint, IdCard)}
      {photoRow('vehicle', text.photoVehicle, text.photoVehicleHint, Bus)}
      {error ? <Notice tone="danger" icon={CircleAlert} title={error} /> : null}
      <Button label={text.next} icon={ArrowRight} disabled={!progress.uploaded.id || !progress.uploaded.vehicle || sending !== null} onPress={onDone} />
    </>
  );
}

// --- Waiting for approval, then collecting the setup once

function WaitingStep({ onDone, onAgain }: { onDone: () => void; onAgain: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const text = strings.driver.register;
  const token = useRegistrationStore((state) => state.token);
  const [status, setStatus] = useState<WaitingStatus | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const collecting = useRef(false);

  const collect = useCallback(async () => {
    if (!token || collecting.current) return;
    // A setup can be collected once: the phone must be able to take it first
    const block = setupBlock();
    if (block) {
      setError(block === 'bluetooth_off' ? strings.driver.provision.bluetoothFirst : strings.driver.provision.cannotBeacon);
      return;
    }
    collecting.current = true;
    const result = await collectSetup(token);
    if (!result.ok) {
      collecting.current = false;
      if (result.error === 'expired') setStatus('expired');
      else setError(result.error === 'not_ready' ? text.notReady : errorText(result.error));
      return;
    }
    const outcome = await applySetup(result.setup);
    collecting.current = false;
    if (outcome === 'done') {
      useRegistrationStore.getState().resetRegistration();
      onDone();
      return;
    }
    setError(strings.driver.provision.failed);
  }, [token, onDone, text.notReady]);

  const check = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    const result = await registrationStatus(token);
    setBusy(false);
    if (!result.ok) {
      if (result.error === 'unknown') setStatus('unknown');
      else setError(errorText(result.error));
      return;
    }
    const found = waitingStatus(result.status);
    setStatus(found);
    setReason(result.reason);
    if (mayCollect(found)) await collect();
  }, [token, collect]);

  // Asks at once (just after the screen shows), then every REGISTRATION_STATUS_POLL_S and on return
  useEffect(() => {
    const first = setTimeout(() => void check());
    const timer = setInterval(() => void check(), REGISTRATION_STATUS_POLL_S * MS_PER_S);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      foreground.remove();
    };
  }, [check]);

  const again = () => {
    useRegistrationStore.getState().resetRegistration();
    onAgain();
  };

  if (status && mustRegisterAgain(status)) {
    const rejected = status === 'rejected';
    return (
      <>
        <Notice
          tone={rejected ? 'danger' : 'warning'}
          icon={rejected ? CircleAlert : Clock}
          title={rejected ? text.rejectedTitle : text.expiredTitle}
          body={rejected ? (reason ? text.rejectedReason(reason) : undefined) : text.expiredBody}
        />
        <Button label={text.registerAgain} leadingIcon={RotateCcw} onPress={again} />
      </>
    );
  }

  const approved = status === 'approved' || status === 'collected';
  return (
    <>
      <Card style={styles.checking}>
        {approved ? <CircleCheckBig color={colors.success} size={DONE_ICON} /> : <Clock color={colors.textSecondary} size={DONE_ICON} />}
        <Text style={[typography.headlineSm, styles.center]} accessibilityRole="header">
          {approved ? text.approvedTitle : text.waitingTitle}
        </Text>
        <Text style={[typography.bodyMd, styles.center, styles.muted]}>{approved ? text.approvedBody : text.waitingBody}</Text>
      </Card>
      {approved ? null : <Text style={[typography.bodyMd, styles.muted]}>{text.waitingKeep}</Text>}
      {error ? <Notice tone="danger" icon={CircleAlert} title={error} /> : null}
      <Button label={busy ? text.checking : text.checkNow} leadingIcon={RotateCcw} variant="secondary" disabled={busy} onPress={() => void check()} />
    </>
  );
}

// --- Small parts

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

// One line of "Check and send", with Edit to go back to its step
function Row({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const text = strings.driver.register;
  return (
    <View style={styles.editRow}>
      <View style={styles.row}>
        <Text style={[typography.labelSm, styles.caps, styles.muted]}>{label}</Text>
        <Text style={typography.bodyLg}>{value}</Text>
      </View>
      <Pressable
        style={styles.edit}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={text.reviewEditLabel(label)}
        hitSlop={spacing.xs}>
        <Pencil color={colors.primary} size={EDIT_ICON} />
        <Text style={[typography.labelLg, { color: colors.primary }]}>{text.reviewEdit}</Text>
      </Pressable>
    </View>
  );
}

// One step of the restricted-setting fix, as on the QR setup screen (Stitch 3.9)
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
  input: {
    minHeight: MIN_TOUCH_TARGET + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  inputText: {
    flex: 1,
    color: colors.textPrimary,
  },
  // The live camera: no clipping and no fill, as on the QR screen (they hide the camera on Android)
  cameraLive: {
    height: CAMERA_HEIGHT,
  },
  fill: { flex: 1 },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.md,
  },
  row: {
    flex: 1,
    gap: spacing.xs / 2,
    paddingVertical: spacing.xs,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.sm,
  },
  checking: {
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingVertical: spacing.lg,
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

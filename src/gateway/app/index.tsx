import { BatteryState, useBatteryLevel, useBatteryState } from 'expo-battery';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ADMIN_PIN_DIGITS } from '@/shared/config';
import { checkAdminPin } from '@/shared/driver/provisioning';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import { carrierTestEnabled } from '../carrierTest';
import { canStartGateway, describeGateway, gatewaySettings, useGatewayStatus, type Tone } from '../features/service';
import { useGatewayStore } from '../state/gatewayStore';
import {
  canSendSms,
  gatewayClear,
  gatewayStart,
  gatewayStop,
  isIgnoringBatteryOptimizations,
  isSmsAvailable,
  listSims,
  requestIgnoreBatteryOptimizations,
} from '../../../modules/tunton-sms';

// DR7: the gateway phone's screen (PRD 9.6). At a glance: is it sending, can it reach the worker, what
// it sent today, the battery and the SIM. Start, Stop, the event log, set up again and (in development
// and preview builds) the carrier test are behind the admin PIN, so a passer-by cannot stop it.

const TICK_MS = 5000;
const PERCENT = 100;
const MS_PER_S = 1000;

function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function GatewayHome() {
  const setup = useGatewayStore((state) => state.setup);
  const resetGateway = useGatewayStore((state) => state.resetGateway);
  const status = useGatewayStatus();
  const now = useNow();
  const level = useBatteryLevel();
  const batteryState = useBatteryState();
  const [unrestricted, setUnrestricted] = useState(isIgnoringBatteryOptimizations);
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const text = strings.gateway.home;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setUnrestricted(isIgnoringBatteryOptimizations());
    });
    return () => subscription.remove();
  }, []);

  if (!setup) return <Redirect href="/setup" />;

  const summary = describeGateway(status, now);
  const tone = (value: Tone) => (value === 'ok' ? colors.success : value === 'warn' ? colors.warning : colors.danger);
  const charging = batteryState === BatteryState.CHARGING || batteryState === BatteryState.FULL;
  const sms = isSmsAvailable() && canSendSms();
  const simLabel = listSims().find((info) => info.subscriptionId === status.subscriptionId);

  const unlock = () => {
    const ok = checkAdminPin(pin, setup);
    setUnlocked(ok);
    setWrong(!ok);
    setPin('');
  };

  const toggle = async () => {
    setBusy(true);
    try {
      if (status.enabled) await gatewayStop();
      else await gatewayStart(gatewaySettings());
    } finally {
      setBusy(false);
    }
  };

  const setUpAgain = async () => {
    await gatewayClear();
    resetGateway();
    router.replace('/setup');
  };

  return (
    <Screen title={strings.gateway.appName}>
      <View style={styles.card}>
        <Text style={[typography.headlineMd, { color: tone(summary.tone) }]}>{summary.label}</Text>
        <Text style={typography.bodyMd}>{text.gateway(setup.gatewayId)}</Text>
      </View>

      {!sms ? <Warning text={text.smsOff} /> : null}
      {!unrestricted ? (
        <View style={[styles.card, styles.warning]}>
          <Text style={typography.bodyLg}>{text.batteryOptimised}</Text>
          <Button label={text.allowBackground} variant="secondary" onPress={requestIgnoreBatteryOptimizations} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={typography.labelLg}>{text.worker}</Text>
        <Text style={typography.bodyMd} selectable>
          {setup.workerUrl}
        </Text>
        <Text style={typography.bodyMd}>{status.lastPullMs === null ? text.never : text.lastPull(Math.max(0, Math.round((now - status.lastPullMs) / MS_PER_S)))}</Text>
        {status.lastError ? <Text style={[typography.bodyMd, { color: colors.danger }]}>{text.lastError(status.lastError)}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={typography.labelLg}>{text.today}</Text>
        <Text style={typography.headlineSm}>{text.counts(status.sentToday, status.deliveredToday, status.failedToday)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={typography.labelLg}>{text.phone}</Text>
        <Text style={[typography.bodyMd, { color: charging ? colors.textPrimary : colors.danger }]}>
          {text.battery(level >= 0 ? Math.round(level * PERCENT) : 0, charging)}
        </Text>
        <Text style={typography.bodyMd}>{text.sim(simLabel ? (simLabel.carrierName ?? simLabel.displayName ?? String(simLabel.subscriptionId)) : text.simDefault)}</Text>
      </View>

      <Text style={typography.headlineSm}>{text.adminTitle}</Text>
      {!unlocked ? (
        <>
          <TextInput
            style={[typography.headlineMd, styles.pin]}
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, ''))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={ADMIN_PIN_DIGITS}
            placeholder={text.pin}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={text.pin}
          />
          {wrong ? <Text style={[typography.bodyLg, { color: colors.danger }]}>{text.wrongPin}</Text> : null}
          <Button label={text.unlock} onPress={unlock} disabled={pin.length !== ADMIN_PIN_DIGITS} />
        </>
      ) : (
        <>
          <Button
            label={status.enabled ? text.stop : text.start}
            variant={status.enabled ? 'secondary' : 'primary'}
            onPress={() => void toggle()}
            disabled={busy || (!status.enabled && !canStartGateway(status, sms))}
          />
          <Button label={text.log} variant="secondary" onPress={() => router.push('/log')} />
          {carrierTestEnabled() ? <Button label={strings.gateway.spike.open} variant="secondary" onPress={() => router.push('/spike')} /> : null}
          {confirmingReset ? (
            <>
              <Text style={typography.bodyLg}>{text.setUpAgainConfirm}</Text>
              <Button label={text.setUpAgain} variant="danger" onPress={() => void setUpAgain()} />
            </>
          ) : (
            <Button label={text.setUpAgain} variant="text" onPress={() => setConfirmingReset(true)} />
          )}
        </>
      )}
    </Screen>
  );
}

function Warning({ text }: { text: string }) {
  const styles = useStyles();
  const { typography } = useTheme();
  return (
    <View style={[styles.card, styles.warning]}>
      <Text style={typography.bodyLg}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  warning: {
    gap: spacing.sm,
    borderColor: colors.warningContainer,
    backgroundColor: colors.warningContainer,
  },
  pin: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.textPrimary,
    letterSpacing: spacing.sm,
  },
}));

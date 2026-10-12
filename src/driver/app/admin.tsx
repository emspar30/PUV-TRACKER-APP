import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ADMIN_PIN_DIGITS } from '@/shared/config';
import { checkAdminPin } from '@/shared/driver/provisioning';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import { beaconOptions, useBeaconStatus } from '../features/beacon/beacon';
import { drainAndApply, ensureInboxConfigured } from '../features/heatmap/inbox';
import { requestSmsPermission } from '../features/heatmap/smsPermission';
import { useDriverStore } from '../state/driverStore';
import { useHeatmapStore } from '../state/heatmapStore';
import { clearProvisioning, isBeaconAvailable, startAdvertising, stopAdvertising } from '../../../modules/tunton-beacon';
import { canReceiveSms, disableInbox, inboxSize, isSmsAvailable } from '../../../modules/tunton-sms';

// DR4: the admin screen behind the PIN (Q12), reached by holding the status strip for 3 s. Turn the
// beacon on or off, see the code it is sending (for DR4-M3), or remove the setup to set it up again.
// DR5: the heatmap messages: how many were accepted, the dropped ones by reason (DR5-M2), a short
// log (kind, time, outcome, sequence number; never a message body), the clock samples, and the text
// messages permission for a phone set up before DR5.

const pad2 = (value: number) => String(value).padStart(2, '0');
const clockTime = (ms: number) => {
  const date = new Date(ms);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};
export default function DriverAdmin() {
  const setup = useDriverStore((state) => state.setup);
  const beaconEnabled = useDriverStore((state) => state.beaconEnabled);
  const setBeaconEnabled = useDriverStore((state) => state.setBeaconEnabled);
  const resetDriver = useDriverStore((state) => state.resetDriver);
  const accepted = useHeatmapStore((state) => state.accepted);
  const rejected = useHeatmapStore((state) => state.rejected);
  const recent = useHeatmapStore((state) => state.recent);
  const driftSamples = useHeatmapStore((state) => state.driftSamples);
  const resetHeatmap = useHeatmapStore((state) => state.resetHeatmap);
  const status = useBeaconStatus();
  const [smsOn, setSmsOn] = useState(canReceiveSms);
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const text = strings.driver.admin;

  // Anything that arrived while this screen was closed shows up here too
  useEffect(() => {
    if (unlocked) drainAndApply().catch(() => undefined);
  }, [unlocked]);

  if (!setup) return null;

  const allowSms = async () => {
    const granted = await requestSmsPermission();
    setSmsOn(granted);
    if (granted) await ensureInboxConfigured();
  };

  const unlock = () => {
    const ok = checkAdminPin(pin, setup);
    setUnlocked(ok);
    setWrong(!ok);
    setPin('');
  };

  const toggleBeacon = async () => {
    if (!isBeaconAvailable()) return;
    if (beaconEnabled) await stopAdvertising();
    else await startAdvertising(beaconOptions());
    setBeaconEnabled(!beaconEnabled);
  };

  const setUpAgain = async () => {
    if (isBeaconAvailable()) await clearProvisioning();
    if (isSmsAvailable()) await disableInbox();
    resetDriver();
    resetHeatmap();
    router.replace('/provision');
  };

  if (!unlocked) {
    return (
      <Screen title={text.title}>
        <Text style={typography.headlineSm}>{text.pinPrompt}</Text>
        <TextInput
          style={[typography.headlineMd, styles.pin]}
          value={pin}
          onChangeText={(value) => setPin(value.replace(/\D/g, ''))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={ADMIN_PIN_DIGITS}
          autoFocus
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={text.pinPrompt}
        />
        {wrong ? <Text style={[typography.bodyLg, { color: colors.danger }]}>{text.wrongPin}</Text> : null}
        <Button label={text.unlock} onPress={unlock} disabled={pin.length !== ADMIN_PIN_DIGITS} />
      </Screen>
    );
  }

  return (
    <Screen title={text.title}>
      <View style={styles.card}>
        <Text style={typography.headlineSm}>{text.device(setup.deviceId, setup.shortId)}</Text>
        <Text style={typography.bodyMd} selectable>
          {status.lastPayloadHex !== null && status.lastSlot !== null ? text.code(status.lastPayloadHex, status.lastSlot) : text.noCode}
        </Text>
        {status.lastError ? <Text style={[typography.bodyMd, { color: colors.danger }]}>{status.lastError}</Text> : null}
      </View>
      <View style={styles.card}>
        <Text style={typography.headlineSm}>{text.smsTitle}</Text>
        <Text style={typography.bodyMd}>{text.smsCounts(accepted, inboxSize())}</Text>
        {driftSamples.length > 0 ? <Text style={typography.bodyMd}>{text.clockDrift(driftSamples[driftSamples.length - 1])}</Text> : null}
        <Text style={typography.labelLg}>{text.rejected}</Text>
        <Text style={typography.bodyMd}>
          {Object.keys(rejected).length === 0
            ? text.noneRejected
            : Object.entries(rejected)
                .map(([reason, count]) => `${reason} ${count}`)
                .join(' · ')}
        </Text>
        <Text style={typography.labelLg}>{text.recentTitle}</Text>
        {recent.length === 0 ? <Text style={typography.bodyMd}>{text.noRecent}</Text> : null}
        {recent.map((log, index) => (
          <Text key={`${log.receivedMs}-${index}`} style={[typography.bodyMd, { color: log.outcome === 'accepted' ? colors.textPrimary : colors.danger }]}>
            {text.logLine(clockTime(log.receivedMs), log.kind, log.outcome, log.seq)}
          </Text>
        ))}
      </View>
      {isSmsAvailable() && !smsOn ? (
        <>
          <Text style={[typography.bodyLg, { color: colors.danger }]}>{text.smsOff}</Text>
          <Button label={text.smsAllow} onPress={() => void allowSms()} />
        </>
      ) : null}
      <Button label={beaconEnabled ? text.turnOff : text.turnOn} variant={beaconEnabled ? 'secondary' : 'primary'} onPress={() => void toggleBeacon()} />
      {confirmingReset ? (
        <>
          <Text style={typography.bodyLg}>{text.setUpAgainConfirm}</Text>
          <Button label={text.setUpAgain} variant="danger" onPress={() => void setUpAgain()} />
        </>
      ) : (
        <Button label={text.setUpAgain} variant="text" onPress={() => setConfirmingReset(true)} />
      )}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  pin: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.textPrimary,
    letterSpacing: spacing.sm,
  },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
}));

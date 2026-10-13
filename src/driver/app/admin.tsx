import { router } from 'expo-router';
import { LockOpen, MessageSquare, Power, RadioTower, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconTile } from '@/components/IconTile';
import { StatusPill, type StatusTone } from '@/components/Pills';
import { Screen } from '@/components/Screen';
import { ADMIN_PIN_DIGITS } from '@/shared/config';
import { checkAdminPin } from '@/shared/driver/provisioning';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

import { Notice } from '../components/Notice';
import { PinPad } from '../components/PinPad';
import { beaconOptions, describeBeacon, useBeaconStatus } from '../features/beacon/beacon';
import type { Tone } from '../features/heatmap/describe';
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
// Look: the Stitch designs 3.11 and 3.12 (docs/DRIVER_UI_PRD.md) in the commuter app's style: the PIN
// as six boxes over a full-width on-screen keypad, Unlock at the bottom (one-handed, owner 2026-10-14); then one card for the beacon and one for the messages, codes
// and the log in a fixed-width font so their columns line up.

const SHIELD_SIZE = spacing.xl + spacing.md;
const SHIELD_ICON = spacing.lg;
const PILL_TONE: Record<Tone, StatusTone> = { ok: 'success', warn: 'warning', bad: 'danger' };

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
      <Screen title={text.title} scroll={false}>
        <View style={styles.pinHead}>
          <View style={styles.shield}>
            <ShieldCheck color={colors.primary} size={SHIELD_ICON} />
          </View>
          <Text style={typography.headlineLg} accessibilityRole="header">
            {text.pinPrompt}
          </Text>
        </View>
        <PinPad length={ADMIN_PIN_DIGITS} value={pin} onChange={setPin} label={text.pinPrompt} error={wrong ? text.wrongPin : null} />
        <Button label={text.unlock} leadingIcon={LockOpen} onPress={unlock} disabled={pin.length !== ADMIN_PIN_DIGITS} />
      </Screen>
    );
  }

  const beacon = describeBeacon(status);
  const dropped = Object.entries(rejected);

  return (
    <Screen title={text.title}>
      {isSmsAvailable() && !smsOn ? (
        <Notice tone="danger" icon={TriangleAlert} title={text.smsOff}>
          <Button label={text.smsAllow} leadingIcon={MessageSquare} onPress={() => void allowSms()} />
        </Notice>
      ) : null}
      <Card>
        <View style={styles.cardHead}>
          <IconTile icon={RadioTower} />
          <Text style={[typography.headlineSm, styles.grow]}>{text.device(setup.deviceId, setup.shortId)}</Text>
        </View>
        <StatusPill label={beacon.label} tone={PILL_TONE[beacon.tone]} />
        <View style={styles.inset}>
          <Text style={[typography.bodyMd, styles.mono]} selectable>
            {status.lastPayloadHex !== null && status.lastSlot !== null ? text.code(status.lastPayloadHex, status.lastSlot) : text.noCode}
          </Text>
        </View>
        {status.lastError ? <Text style={[typography.bodyMd, { color: colors.danger }]}>{status.lastError}</Text> : null}
      </Card>
      <Card>
        <View style={styles.cardHead}>
          <IconTile icon={MessageSquare} />
          <Text style={[typography.headlineSm, styles.grow]}>{text.smsTitle}</Text>
        </View>
        <View style={styles.inset}>
          <View style={styles.counts}>
            <Text style={typography.headlineMd}>{text.accepted(accepted)}</Text>
            <Text style={typography.bodyMd}>{text.inbox(inboxSize())}</Text>
          </View>
          {driftSamples.length > 0 ? <Text style={typography.bodyMd}>{text.clockDrift(driftSamples[driftSamples.length - 1])}</Text> : null}
        </View>
        <Text style={[typography.labelSm, styles.caps]}>{text.rejected}</Text>
        {dropped.length === 0 ? (
          <Text style={typography.bodyMd}>{text.noneRejected}</Text>
        ) : (
          <View style={styles.reasons}>
            {dropped.map(([reason, count]) => (
              <View key={reason} style={styles.reason}>
                <Text style={[typography.labelMd, styles.mono]}>{reason}</Text>
                <Text style={[typography.labelMd, styles.reasonCount]}>{count}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[typography.labelSm, styles.caps]}>{text.recentTitle}</Text>
        {recent.length === 0 ? <Text style={typography.bodyMd}>{text.noRecent}</Text> : null}
        {recent.map((log, index) => (
          <Text
            key={`${log.receivedMs}-${index}`}
            style={[typography.bodySm, styles.mono, { color: log.outcome === 'accepted' ? colors.textPrimary : colors.danger }]}
          >
            {text.logLine(clockTime(log.receivedMs), log.kind, log.outcome, log.seq)}
          </Text>
        ))}
      </Card>
      <Button
        label={beaconEnabled ? text.turnOff : text.turnOn}
        leadingIcon={Power}
        variant={beaconEnabled ? 'secondary' : 'primary'}
        onPress={() => void toggleBeacon()}
      />
      {confirmingReset ? (
        <Notice tone="danger" icon={RotateCcw} title={text.setUpAgainConfirm}>
          <Button label={text.setUpAgain} leadingIcon={RotateCcw} variant="danger" onPress={() => void setUpAgain()} />
        </Notice>
      ) : (
        <Button label={text.setUpAgain} leadingIcon={RotateCcw} variant="text" onPress={() => setConfirmingReset(true)} />
      )}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  pinHead: {
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  shield: {
    width: SHIELD_SIZE,
    height: SHIELD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SHIELD_SIZE,
    backgroundColor: colors.primaryContainer,
  },
  grow: {
    flex: 1,
  },
  caps: {
    textTransform: 'uppercase',
  },
  // Codes and the log: Android's fixed-width font, so the columns line up
  mono: {
    fontFamily: 'monospace',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  inset: {
    gap: spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + spacing.xs / 2,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  reasonCount: {
    color: colors.danger,
    fontWeight: '700',
  },
}));

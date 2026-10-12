import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, PermissionsAndroid, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SEED_STATIONS } from '@/data/seed/routes';
import { DATA_SMS_PORT, GATEWAY_SEND_GAP_MS } from '@/shared/config';
import { normalizePhNumber } from '@/shared/driver/phone';
import { buildTestHeatmap, paddingCodes } from '@/shared/sms/testMessage';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import { carrierTestEnabled } from '../carrierTest';
import { addSendResultListener, canSendSms, listSims, sendData, sendText, type SendResult, type SimInfo } from '../../../modules/tunton-sms';

// DR5: the carrier test (plan DR5 task 2, device test DR5-M5; PRD 16 risk 4). Sends signed test
// heatmap messages, as text or as data SMS on DATA_SMS_PORT, from this phone's chosen SIM to a driver
// phone set up with dev-driver-qr.ts, and shows each one's sent and delivery results. "Extra stops"
// makes the message bigger, to find the largest data SMS the carrier delivers. The bad copies check
// that the driver phone drops them (DR5-M2). Only in development and preview builds of the gateway
// app (carrierTest.ts); a release build never has it.

type Mode = 'normal' | 'repeat' | 'bad_signature' | 'old_time';
type Sent = { n: number; kind: 'text' | 'data'; mode: Mode; id: string | null; error: string | null; sentAtMs: number };
type Results = Record<string, { sent?: SendResult; delivered?: SendResult }>;

const MODES: Mode[] = ['normal', 'repeat', 'bad_signature', 'old_time'];
const MAX_COUNT = 20;
// Enough to pass DATA_SMS_MAX_BYTES and the one-text limit with any route
const MAX_PADDING = 30;
const MAX_COUNT_PER_STOP = 15;
const OLD_TIME_MIN = 40;
const MS_PER_MIN = 60_000;
const ROUTE_RE = /^R\d{1,2}$/;
const KEY_RE = /^[0-9a-fA-F]{64}$/;
// The size of a message does not depend on its time: the preview signs as if at midnight
const PREVIEW_AT_MS = 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Batch = { kind: 'text' | 'data'; mode: Mode; times: number; to: string; route: string; seq: number; codes: string[]; key: string; sim: number | null };

// Sends `times` messages, GATEWAY_SEND_GAP_MS apart, and returns the next sequence number. A repeat
// reuses the last sequence number; every other mode takes the next one.
async function sendBatch(batch: Batch, onSent: (entry: Omit<Sent, 'n'>) => void): Promise<number> {
  const { kind, mode, times, to, route, codes, key, sim } = batch;
  let next = batch.seq;
  for (let i = 0; i < times; i++) {
    const seq = mode === 'repeat' ? Math.max(0, next - 1) : next;
    const atMs = mode === 'old_time' ? Date.now() - OLD_TIME_MIN * MS_PER_MIN : Date.now();
    const nodes = codes.map((code) => ({ code, count: Math.floor(Math.random() * MAX_COUNT_PER_STOP) }));
    const message = buildTestHeatmap(route, seq, nodes, atMs, key);
    // A changed signature: the last hex digit of the MAC (text) or the last byte (data)
    const plain = kind === 'text' ? message.text : message.dataHex;
    const body = mode !== 'bad_signature' ? plain : kind === 'text' ? plain.slice(0, -1) + (plain.endsWith('0') ? '1' : '0') : plain.slice(0, -2) + (plain.endsWith('00') ? '01' : '00');
    const entry: Omit<Sent, 'n'> = { kind, mode, id: null, error: null, sentAtMs: Date.now() };
    try {
      entry.id = kind === 'text' ? await sendText(to, body, sim) : await sendData(to, DATA_SMS_PORT, body, sim);
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
    }
    onSent(entry);
    if (mode !== 'repeat') next += 1;
    if (i < times - 1) await wait(GATEWAY_SEND_GAP_MS);
  }
  return next;
}

export default function CarrierTest() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const text = strings.gateway.spike;
  const [to, setTo] = useState('');
  const [key, setKey] = useState('');
  const [route, setRoute] = useState('R4');
  const [seq, setSeq] = useState(1);
  const [count, setCount] = useState('1');
  const [padding, setPadding] = useState('0');
  const [mode, setMode] = useState<Mode>('normal');
  const [sims, setSims] = useState<SimInfo[]>(listSims);
  const [canSend, setCanSend] = useState(canSendSms);
  const [sim, setSim] = useState<number | null>(null);
  const [log, setLog] = useState<Sent[]>([]);
  // Kept apart from the log, so a result that comes back before its entry is shown is not lost
  const [results, setResults] = useState<Results>({});
  const [busy, setBusy] = useState(false);
  const counter = useRef(0);

  useEffect(() => {
    const subscription = addSendResultListener((result) => {
      setResults((all) => ({ ...all, [result.id]: { ...all[result.id], [result.stage]: result } }));
    });
    return () => subscription?.remove();
  }, []);

  if (!carrierTestEnabled()) return <Redirect href="/" />;

  const target = normalizePhNumber(to);
  const routeOk = ROUTE_RE.test(route);
  const codes = [
    ...SEED_STATIONS.filter((station) => station.routeCodes.includes(route)).map((station) => station.code),
    ...paddingCodes(Math.min(MAX_PADDING, Math.max(0, Number(padding) || 0))),
  ];
  // Two-digit counts, as on a busy route
  const preview = routeOk && KEY_RE.test(key) && codes.length > 0 ? buildTestHeatmap(route, seq, codes.map((code) => ({ code, count: 10 })), PREVIEW_AT_MS, key) : null;

  const allow = async () => {
    await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.SEND_SMS, PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE]);
    setSims(listSims());
    setCanSend(canSendSms());
  };

  const send = async (kind: 'text' | 'data') => {
    if (!target || !routeOk || !KEY_RE.test(key)) return;
    setBusy(true);
    const times = Math.min(MAX_COUNT, Math.max(1, Number(count) || 1));
    const next = await sendBatch({ kind, mode, times, to: target, route, seq, codes, key: key.toLowerCase(), sim }, (entry) => {
      counter.current += 1;
      const numbered = { ...entry, n: counter.current };
      setLog((entries) => [numbered, ...entries]);
    });
    setSeq(next);
    setBusy(false);
  };

  const describe = (result: SendResult | undefined, since: number) =>
    result ? `${result.ok ? 'ok' : `fail ${result.errorCode ?? result.status ?? result.resultCode}`} ${((result.atMs - since) / 1000).toFixed(1)} s` : text.pending;

  return (
    <Screen title={text.title}>
      <Text style={typography.bodyMd}>{text.intro}</Text>
      {canSend ? null : (
        <>
          <Text style={[typography.bodyMd, { color: colors.danger }]}>{text.smsOff}</Text>
          <Button label={text.permissions} variant="secondary" onPress={() => void allow()} />
          <Button label={text.openSettings} variant="text" onPress={() => void Linking.openSettings()} />
        </>
      )}

      <Field label={text.to} value={to} onChange={setTo} keyboard="phone-pad" />
      <Field label={text.key} value={key} onChange={(value) => setKey(value.trim())} />
      <View style={styles.row}>
        <Field label={text.route} value={route} onChange={(value) => setRoute(value.trim().toUpperCase())} flex />
        <Field label={text.seq} value={String(seq)} onChange={(value) => setSeq(Number(value.replace(/\D/g, '')) || 0)} keyboard="number-pad" flex />
      </View>
      <View style={styles.row}>
        <Field label={text.count} value={count} onChange={setCount} keyboard="number-pad" flex />
        <Field label={text.padStops} value={padding} onChange={setPadding} keyboard="number-pad" flex />
      </View>

      <Text style={typography.labelLg}>{text.sim}</Text>
      <View style={styles.chips}>
        {sims.length === 0 ? <Text style={typography.bodyMd}>{text.noSims}</Text> : null}
        {sims.map((info) => (
          <Chip key={info.subscriptionId} label={`${info.slotIndex + 1}: ${info.carrierName ?? info.displayName ?? info.subscriptionId}`} on={sim === info.subscriptionId} onPress={() => setSim(sim === info.subscriptionId ? null : info.subscriptionId)} />
        ))}
      </View>
      <View style={styles.chips}>
        {MODES.map((value) => (
          <Chip key={value} label={value} on={mode === value} onPress={() => setMode(value)} />
        ))}
      </View>

      {preview ? <Text style={typography.bodyMd}>{text.size(preview.bytes, preview.septets)}</Text> : null}
      {!target || !preview ? <Text style={[typography.bodyMd, { color: colors.danger }]}>{text.invalid}</Text> : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label={text.sendData} onPress={() => void send('data')} disabled={busy || !target || !preview} />
        </View>
        <View style={styles.flex}>
          <Button label={text.sendText} variant="secondary" onPress={() => void send('text')} disabled={busy || !target || !preview} />
        </View>
      </View>

      <Text style={typography.headlineSm}>{text.results}</Text>
      {log.length === 0 ? <Text style={typography.bodyMd}>{text.none}</Text> : null}
      {log.map((entry) => (
        <Text key={entry.n} style={[typography.bodyMd, entry.error ? { color: colors.danger } : null]} selectable>
          {entry.error
            ? `#${entry.n} ${entry.kind} · ${entry.error}`
            : `${text.line(entry.n, `${entry.kind} ${entry.mode}`, describe(entry.id ? results[entry.id]?.sent : undefined, entry.sentAtMs), describe(entry.id ? results[entry.id]?.delivered : undefined, entry.sentAtMs))} · ${new Date(entry.sentAtMs).toLocaleTimeString()}`}
        </Text>
      ))}
    </Screen>
  );
}

function Field({ label, value, onChange, keyboard, flex }: { label: string; value: string; onChange: (value: string) => void; keyboard?: 'phone-pad' | 'number-pad'; flex?: boolean }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.field, flex && styles.flex]}>
      <Text style={typography.labelLg}>{label}</Text>
      <TextInput
        style={[typography.bodyLg, styles.input]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <Pressable style={[styles.chip, on && { backgroundColor: colors.primaryContainer }]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[typography.labelLg, on && { color: colors.onPrimaryContainer }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  field: { gap: spacing.xs },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.textPrimary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
  },
}));

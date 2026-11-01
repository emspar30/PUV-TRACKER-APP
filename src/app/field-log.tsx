import { Share, Switch, Text, View } from 'react-native';

import { Button, Card, Screen } from '@/components';
import { summarize, toCsv } from '@/shared/fieldtest/log';
import { showDialog } from '@/state/dialogStore';
import { useFieldLogStore } from '@/state/fieldLogStore';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

const ONE_DECIMAL = 1;

// S10 (PRD 17.1): the field test log. Recording on, the app notes relays, battery, bytes sent,
// background gaps, Bluetooth signal, verification results and baton roles; the summary gives the
// per-hour figures for docs/FIELD_TESTS.md, and Export shares the whole log as CSV.
export default function FieldLogScreen() {
  const styles = useStyles();
  const { typography } = useTheme();
  const recording = useFieldLogStore((state) => state.recording);
  const events = useFieldLogStore((state) => state.events);
  const setRecording = useFieldLogStore((state) => state.setRecording);
  const clear = useFieldLogStore((state) => state.clear);
  const f = strings.fieldLog;
  const s = summarize(events);
  const n = (value: number | null, unit: string) => (value === null ? f.none : `${value.toFixed(ONE_DECIMAL)} ${unit}`);

  const exportLog = () => {
    void Share.share({ title: f.exportTitle, message: toCsv(events) }).catch(() => undefined);
  };
  const confirmClear = () =>
    showDialog({
      tone: 'warning',
      title: f.clearTitle,
      body: f.clearBody(events.length),
      actions: [
        { label: f.clear, variant: 'danger', onPress: clear },
        { label: f.cancel, variant: 'secondary' },
      ],
    });

  return (
    <Screen title={f.title}>
      <Text style={typography.bodyMd}>{f.body}</Text>
      <Card>
        <View style={styles.row}>
          <Text style={[typography.labelLg, styles.grow]}>{f.recording}</Text>
          <Switch value={recording} onValueChange={setRecording} accessibilityLabel={f.recording} />
        </View>
        <Text style={typography.bodySm}>{f.events(events.length)}</Text>
      </Card>
      <Card>
        <Text style={typography.labelLg}>{f.summary}</Text>
        <Text style={typography.bodySm}>{f.relays(s.relays, s.relayHours)}</Text>
        <Text style={typography.bodySm}>{f.battery(n(s.batteryPctPerHour, f.pctPerHour))}</Text>
        <Text style={typography.bodySm}>{f.data(n(s.kbPerHour, f.kbPerHour))}</Text>
        <Text style={typography.bodySm}>{f.gaps(s.gaps)}</Text>
        <Text style={typography.bodySm}>{s.rssi ? f.rssi(s.rssi.count, s.rssi.median, s.rssi.min, s.rssi.max) : f.rssiNone}</Text>
        <Text style={typography.bodySm}>{f.verify(n(s.verifyPassRate, '%'), n(s.medianVerifyS, 's'))}</Text>
        <Text style={typography.bodySm}>{f.handoffs(s.handoffs)}</Text>
      </Card>
      <Button label={f.export} onPress={exportLog} disabled={events.length === 0} />
      <Button label={f.clear} variant="secondary" onPress={confirmClear} disabled={events.length === 0} />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
}));

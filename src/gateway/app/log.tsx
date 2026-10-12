import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

import { addGatewayStatusListener, gatewayEvents, type GatewayEvent } from '../../../modules/tunton-sms';

// DR7: the gateway's last events, newest first (GATEWAY_EVENTS_MAX): starts and stops, pulls, each
// message sent, delivered or failed, and problems reaching the worker. Phone numbers are masked by
// the native module before they are stored.

const pad2 = (value: number) => String(value).padStart(2, '0');
const clock = (ms: number) => {
  const date = new Date(ms);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

export default function GatewayLog() {
  const [events, setEvents] = useState<GatewayEvent[]>(gatewayEvents);
  const styles = useStyles();
  const { colors, typography } = useTheme();

  useEffect(() => {
    const subscription = addGatewayStatusListener(() => setEvents(gatewayEvents()));
    return () => subscription?.remove();
  }, []);

  const color = (kind: GatewayEvent['kind']) =>
    kind === 'failed' || kind === 'error' ? colors.danger : kind === 'delivered' || kind === 'sent' ? colors.success : colors.textSecondary;

  return (
    <Screen title={strings.gateway.log.title}>
      {events.length === 0 ? <Text style={typography.bodyLg}>{strings.gateway.log.empty}</Text> : null}
      <View style={styles.list}>
        {events.map((event, index) => (
          <View key={`${event.atMs}-${index}`} style={styles.row}>
            <Text style={[typography.labelMd, styles.time]}>{clock(event.atMs)}</Text>
            <Text style={[typography.labelMd, { color: color(event.kind) }]}>{event.kind}</Text>
            <Text style={[typography.bodyMd, styles.text]} selectable>
              {event.text}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  time: { color: colors.textTertiary, fontVariant: ['tabular-nums'] },
  text: { flex: 1 },
}));

import { router } from 'expo-router';
import { ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, IconTile } from '@/components';
import { TRUST_LEVEL_MIN_REPORTS } from '@/shared/config';
import { mayAppeal } from '@/shared/moderation/rules';
import { refreshModeration, useModerationStore } from '@/state/moderationStore';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

// MOD1b: Profile's "Trust and safety": the Trust Level (after enough reports), Merit shields, a
// suspension and its end, and each strike in plain words with Appeal. Live data only.
export function ModerationCard() {
  const styles = useStyles();
  const { typography } = useTheme();
  const snapshot = useModerationStore((state) => state.snapshot);
  const m = strings.moderation;
  const [nowMs] = useState(Date.now);

  useEffect(() => {
    void refreshModeration();
  }, []);

  if (!snapshot) return null;

  const suspended = snapshot.suspendedUntilMs !== null && snapshot.suspendedUntilMs > nowMs;

  return (
    <Card>
      <View style={styles.head}>
        <IconTile icon={suspended ? ShieldAlert : ShieldCheck} tone={suspended ? 'danger' : 'success'} />
        <Text style={[typography.labelLg, styles.grow]}>{m.title}</Text>
      </View>
      <Text style={typography.bodyMd}>{snapshot.trustLevel === null ? m.trustLevelSoon(snapshot.reports, TRUST_LEVEL_MIN_REPORTS) : m.trustLevel(snapshot.trustLevel)}</Text>
      <Text style={typography.bodySm}>{m.merit(snapshot.merit)}</Text>
      {suspended && snapshot.suspendedUntilMs !== null ? <Text style={[typography.bodyMd, styles.warn]}>{m.suspendedBody(new Date(snapshot.suspendedUntilMs))}</Text> : null}
      {snapshot.strikes.length === 0 ? <Text style={typography.bodySm}>{m.noStrikes}</Text> : null}
      {snapshot.strikes.map((strike) => (
        <View key={strike.id} style={styles.strike}>
          <Text style={typography.labelMd}>{m.reasons[strike.reason]}</Text>
          <Text style={typography.bodySm}>{m.strikeState(strike, new Date(strike.createdMs), new Date(strike.expiresMs))}</Text>
          {mayAppeal(strike, nowMs) ? <Button label={m.appeal} variant="secondary" onPress={() => router.push({ pathname: '/appeal', params: { strike: strike.id } })} /> : null}
        </View>
      ))}
    </Card>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  warn: {
    color: colors.danger,
  },
  strike: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
}));

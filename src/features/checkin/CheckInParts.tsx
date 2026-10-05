import { Text, View } from 'react-native';

import { Chip } from '@/components';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

const BAR_HEIGHT = spacing.xs + spacing.xs / 2;
const PERCENT = 100;

// Pieces of the Check-in card (C1 UI pass).

// The time left of a check-in as a bar that empties, with its label and the window length
export function ExpiryBar({ fraction, minutes }: { fraction: number; minutes: number }) {
  const styles = useStyles();
  const { typography } = useTheme();
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return (
    <View style={styles.expiry}>
      <View style={styles.between}>
        <Text style={typography.bodySm}>{strings.checkin.expires}</Text>
        <Text style={typography.bodySm}>{strings.checkin.window(minutes)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped * PERCENT}%` }]} />
      </View>
    </View>
  );
}

type RoutePingProps = {
  routes: readonly string[];
  picked: readonly string[];
  onChange: (picked: string[]) => void;
};

// A stop served by two or more routes: ping one, some or all of them. Only the picked routes count
// the commuter, so drivers of the other routes get no SMS about them. At least one stays picked.
export function RoutePing({ routes, picked, onChange }: RoutePingProps) {
  const styles = useStyles();
  const { typography } = useTheme();
  const all = routes.every((code) => picked.includes(code));
  const toggle = (code: string) => {
    const next = picked.includes(code) ? picked.filter((value) => value !== code) : [...picked, code];
    if (next.length > 0) onChange(routes.filter((value) => next.includes(value)));
  };
  return (
    <View style={styles.ping}>
      <View style={styles.between}>
        <Text style={[typography.labelSm, styles.overline]}>{strings.checkin.pingRoutes}</Text>
        <Text style={typography.bodySm}>{strings.checkin.pingHint}</Text>
      </View>
      <View style={styles.chips}>
        <Chip label={strings.checkin.pingAll} selected={all} onPress={() => onChange([...routes])} />
        {routes.map((code) => (
          <Chip
            key={code}
            label={code}
            selected={picked.includes(code)}
            onPress={() => toggle(code)}
            accessibilityLabel={strings.checkin.pingLabel(code, picked.includes(code))}
          />
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  expiry: {
    gap: spacing.xs + spacing.xs / 2,
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  track: {
    height: BAR_HEIGHT,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceHigh,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  ping: {
    gap: spacing.xs + spacing.xs / 2,
  },
  overline: {
    color: colors.primary,
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
}));

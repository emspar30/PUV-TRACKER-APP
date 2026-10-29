import { Moon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { NightPassage } from '@/data/repositories/types';
import { NIGHT_STOPS_SHOWN } from '@/shared/config';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

type NightStopsCardProps = {
  code: string;
  passages: readonly NightPassage[];
  nowMs: number;
  // A stop's short name by its code
  stopName: (code: string) => string;
};

const ICON_SIZE = spacing.md + spacing.xs;
const MS_PER_MIN = 60_000;

// NM1 (PRD 10.4): at night, under the picked route's card, the stops a multicab of the route passed
// lately ("Passed CSU · 3 min ago"), newest first, instead of where it is now. The server shows them
// a few minutes late. Free: no Energy.
export function NightStopsCard({ code, passages, nowMs, stopName }: NightStopsCardProps) {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  const shown = passages.slice(0, NIGHT_STOPS_SHOWN);
  return (
    <View style={[styles.card, elevation.level2]} accessibilityRole="summary">
      <View style={styles.head}>
        <Moon color={colors.textSecondary} size={ICON_SIZE} />
        <Text style={typography.labelLg}>{strings.live.status.nightStopsTitle(code)}</Text>
      </View>
      {shown.length === 0 ? (
        <Text style={typography.bodySm}>{strings.live.status.nightStopsEmpty(code)}</Text>
      ) : (
        shown.map((passage) => (
          <Text key={passage.stopCode} style={typography.bodyMd}>
            {strings.live.status.nightPassed(stopName(passage.stopCode), Math.max(1, Math.round((nowMs - passage.passedAtMs) / MS_PER_MIN)))}
          </Text>
        ))
      )}
      <Text style={[typography.bodySm, styles.note]}>{strings.live.status.nightStopsNote}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    gap: spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  note: {
    color: colors.textSecondary,
  },
}));

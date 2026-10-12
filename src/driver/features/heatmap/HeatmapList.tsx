import { Text, View } from 'react-native';

import type { HeatmapRow } from '@/shared/driver/heatmapView';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

// DR5: the stops in riding order (PRD 9.4), each with a large band chip and, where allowed (Q5,
// Q11), the exact count. Read at a glance, nothing to tap. A stop with no count yet shows a dash,
// never 0; a stale list is greyed as a whole.

const CHIP_MIN_WIDTH = 72;
const STALE_OPACITY = 0.5;

type Props = { rows: readonly HeatmapRow[]; stale: boolean; bandsOnly: boolean };

export function HeatmapList({ rows, stale, bandsOnly }: Props) {
  const styles = useStyles();
  const { colors, mapPaint, typography } = useTheme();
  const text = strings.driver.heatmap;
  const bandColors = [colors.surfaceHigh, mapPaint.occupancyGreen, mapPaint.occupancyAmber, mapPaint.occupancyRed];
  const bandText = [colors.textPrimary, colors.onPrimary, colors.onPrimary, colors.onPrimary];

  if (rows.length === 0) return <Text style={typography.bodyLg}>{text.noStops}</Text>;

  return (
    <View style={[styles.list, stale && { opacity: STALE_OPACITY }]}>
      {bandsOnly ? <Text style={typography.bodyMd}>{text.bandsOnly}</Text> : null}
      {rows.map((row) => {
        const known = row.display.kind === 'known' ? row.display : null;
        const fill = known && !stale ? bandColors[known.band] : colors.surface;
        const ink = known && !stale ? bandText[known.band] : colors.textSecondary;
        return (
          <View key={row.code} style={styles.row} accessible accessibilityLabel={`${row.name}: ${known ? (known.exact !== null ? text.waiting(known.exact) : text.bands[known.band]) : text.unknownLabel}`}>
            <Text style={[typography.headlineSm, styles.name]} numberOfLines={2}>
              {row.name}
            </Text>
            {known && known.exact !== null ? <Text style={[typography.headlineMd, styles.count]}>{known.exact}</Text> : null}
            <View style={[styles.chip, { backgroundColor: fill }]}>
              <Text style={[typography.headlineMd, styles.chipText, { color: ink }]}>{known ? text.bands[known.band] : text.unknown}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: {
    gap: spacing.xs,
  },
  row: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  name: {
    flex: 1,
  },
  count: {
    fontVariant: ['tabular-nums'],
  },
  // Bold at 22 sp is large text (WCAG 3:1): light amber with white is 4.1:1
  chipText: {
    fontWeight: '700',
  },
  chip: {
    minWidth: CHIP_MIN_WIDTH,
    minHeight: MIN_TOUCH_TARGET - spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
}));

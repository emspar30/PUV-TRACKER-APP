import { Text, View } from 'react-native';

import type { HeatmapRow } from '@/shared/driver/heatmapView';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

// DR5: the stops in riding order (PRD 9.4). Read at a glance, nothing to tap. A stop with no count
// yet shows a dash, never 0; a stale list is greyed as a whole.
// Look (Stitch design, 2026-10-12): one white outlined card per stop: its number in riding order,
// the name, the exact count large and bold, and the band as a pill chip. Where only the band may be
// shown (Q5, Q11: at night), the chip takes the count's place and size; the home screen's heading
// says so (Stitch 3.4).

const ROW_MIN_HEIGHT = 56;
const CHIP_MIN_WIDTH = 56;
const BIG_CHIP_MIN_WIDTH = 80;
const INDEX_WIDTH = 22;
const STALE_OPACITY = 0.5;
const COUNT_STYLE = { fontSize: 26, lineHeight: 32, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] };
// Chip labels are bold and at least 19 dp, which WCAG counts as large text (3:1): white on the light
// amber chip is 4.1:1, too low for Stitch's 12 dp label
const CHIP_TEXT = { fontSize: 19, lineHeight: 24 };
const BIG_CHIP_TEXT = { fontSize: 22, lineHeight: 28 };

type Props = { rows: readonly HeatmapRow[]; stale: boolean };

const ordinal = (index: number) => String(index + 1).padStart(2, '0');

export function HeatmapList({ rows, stale }: Props) {
  const styles = useStyles();
  const { colors, mapPaint, typography } = useTheme();
  const text = strings.driver.heatmap;
  const bandColors = [colors.surfaceHigh, mapPaint.occupancyGreen, mapPaint.occupancyAmber, mapPaint.occupancyRed];
  const bandText = [colors.textPrimary, colors.onPrimary, colors.onPrimary, colors.onPrimary];

  if (rows.length === 0) return <Text style={typography.bodyLg}>{text.noStops}</Text>;

  return (
    <View style={[styles.list, stale && { opacity: STALE_OPACITY }]}>
      {rows.map((row, index) => {
        const known = row.display.kind === 'known' ? row.display : null;
        const fill = known && !stale ? bandColors[known.band] : colors.surfaceHigh;
        const ink = known && !stale ? bandText[known.band] : colors.textSecondary;
        const exact = known ? known.exact : null;
        // No number beside it (night, or no count yet): the chip is the big element
        const bigChip = exact === null;
        return (
          <View
            key={row.code}
            style={styles.row}
            accessible
            accessibilityLabel={`${row.name}: ${known ? (exact !== null ? text.waiting(exact) : text.bands[known.band]) : text.unknownLabel}`}
          >
            <Text style={[typography.labelSm, styles.index]}>{ordinal(index)}</Text>
            <Text style={[typography.headlineSm, styles.name]} numberOfLines={2}>
              {row.name}
            </Text>
            {exact !== null ? <Text style={[COUNT_STYLE, { color: colors.textPrimary }]}>{exact}</Text> : null}
            <View style={[styles.chip, bigChip && styles.bigChip, { backgroundColor: fill }]}>
              <Text style={[bigChip ? BIG_CHIP_TEXT : CHIP_TEXT, styles.chipText, { color: ink }]}>
                {known ? text.bands[known.band] : text.unknown}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: {
    gap: spacing.xs + spacing.xs / 2,
  },
  row: {
    minHeight: Math.max(MIN_TOUCH_TARGET, ROW_MIN_HEIGHT),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  index: {
    width: INDEX_WIDTH,
    color: colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  name: {
    flex: 1,
  },
  chip: {
    minWidth: CHIP_MIN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  bigChip: {
    minWidth: BIG_CHIP_MIN_WIDTH,
    paddingVertical: spacing.sm,
  },
  chipText: {
    fontWeight: '700',
  },
}));

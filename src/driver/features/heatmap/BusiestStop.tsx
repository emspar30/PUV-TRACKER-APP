import { Users } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { BusiestStop as Busiest } from '@/shared/driver/heatmapView';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

// Owner, 2026-10-14: the stop with the most passengers waiting, over the list (which stays in riding
// order): "MOST WAITING", the stop's name, and its count (its band at night) on the band's colour.

const ICON_SIZE = spacing.lg;
const CHIP_MIN_WIDTH = spacing.xl * 2;
// Bold and at least 19 dp, as the list's chips: large text for WCAG, so white passes on amber
const CHIP_TEXT = { fontSize: 22, lineHeight: 28, fontWeight: '700' as const };

export function BusiestStop({ stop }: { stop: Busiest }) {
  const styles = useStyles();
  const { colors, mapPaint, typography } = useTheme();
  const text = strings.driver.heatmap;
  const fill = [colors.surfaceHigh, mapPaint.occupancyGreen, mapPaint.occupancyAmber, mapPaint.occupancyRed][stop.band];
  const value = stop.exact !== null ? String(stop.exact) : text.bands[stop.band];
  return (
    <View style={[styles.row, { borderColor: fill }]} accessible accessibilityLabel={text.mostWaitingLabel(stop.name, value)}>
      <Users color={fill} size={ICON_SIZE} />
      <View style={styles.text}>
        <Text style={[typography.labelSm, styles.caps]}>{text.mostWaiting}</Text>
        <Text style={typography.headlineSm} numberOfLines={1}>
          {stop.name}
        </Text>
      </View>
      <View style={[styles.chip, { backgroundColor: fill }]}>
        <Text style={[CHIP_TEXT, { color: colors.onPrimary }]}>{value}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 2,
    backgroundColor: colors.card,
  },
  text: {
    flex: 1,
  },
  caps: {
    textTransform: 'uppercase',
  },
  chip: {
    minWidth: CHIP_MIN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
}));

import { Text, View } from 'react-native';

import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

// What the map's colours mean (owner's request 2026-10-14): one floating pill per band with waiting
// passengers, "● Light (1–4)", "● Moderate (5–9)", "● Crowded (10+)", in the map's node colours. The
// ranges are the list's band labels (HEATMAP_BAND_EDGES).

const DOT_SIZE = spacing.sm + spacing.xs / 2;

export function HeatmapLegend() {
  const styles = useStyles();
  const { mapPaint, typography } = useTheme();
  const text = strings.driver.heatmap;
  const items = [
    { name: text.legend.light, color: mapPaint.occupancyGreen, band: 1 },
    { name: text.legend.moderate, color: mapPaint.occupancyAmber, band: 2 },
    { name: text.legend.crowded, color: mapPaint.occupancyRed, band: 3 },
  ];
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View key={item.band} style={styles.pill}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={typography.labelMd} numberOfLines={1}>
            {text.legend.label(item.name, text.bands[item.band])}
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  // One centred row: the pills shrink before they wrap
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs + spacing.xs / 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs / 2,
    paddingVertical: spacing.xs + spacing.xs / 2,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    ...elevation.level2,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE,
  },
}));

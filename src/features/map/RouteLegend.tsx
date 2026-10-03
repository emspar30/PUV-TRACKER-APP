import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useRouteNetwork } from '@/features/plan/useRouteNetwork';
import { strings } from '@/strings';
import { colors, radii, spacing, typography } from '@/theme';

const SWATCH_WIDTH = 28;
const SWATCH_HEIGHT = 5;
const DASH_COUNT = 3;
const ARROW_SIZE = 14;

function Swatch({ color, dashed }: { color: string; dashed: boolean }) {
  return (
    <View style={styles.swatch}>
      {dashed ? (
        Array.from({ length: DASH_COUNT }, (_, i) => (
          <View key={i} style={[styles.dash, { backgroundColor: color }]} />
        ))
      ) : (
        <View style={[styles.solid, { backgroundColor: color }]} />
      )}
    </View>
  );
}

// Key to the route lines: outbound solid, return dashed, arrows for the direction of travel
export function RouteLegend() {
  const { network } = useRouteNetwork();
  if (!network || network.lines.length === 0) return null;

  return (
    <View style={styles.card} accessibilityLabel={strings.map.legendTitle}>
      {network.lines.map((line) => {
        const isReturn = line.direction === 'return';
        return (
          <View key={line.routeId} style={styles.row}>
            <Swatch color={line.routeColor} dashed={isReturn} />
            <ChevronRight color={colors.routeCasing} size={ARROW_SIZE} />
            <Text style={styles.label}>
              {isReturn ? strings.map.legendReturn(line.routeCode) : strings.map.legendOutbound(line.routeCode)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatch: {
    width: SWATCH_WIDTH,
    height: SWATCH_HEIGHT + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.routeCasing,
    borderRadius: SWATCH_HEIGHT,
    paddingHorizontal: 1,
  },
  solid: {
    flex: 1,
    height: SWATCH_HEIGHT,
    borderRadius: SWATCH_HEIGHT,
  },
  dash: {
    width: SWATCH_WIDTH / (DASH_COUNT + 1),
    height: SWATCH_HEIGHT,
    borderRadius: 1,
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
  },
});

import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { useBentoSpanWidth } from './BentoGrid';

type BentoCardProps = ViewProps & {
  // Number of grid columns the tile occupies inside a BentoGrid
  span?: number;
};

export function BentoCard({ span = 1, style, children, ...rest }: BentoCardProps) {
  const width = useBentoSpanWidth(span);

  return (
    <View style={[styles.card, width !== undefined && { width }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: spacing.xl * 3,
  },
});

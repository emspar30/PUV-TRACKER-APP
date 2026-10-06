import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { makeStyles, radii, spacing } from '@/theme';

const PULSE_MS = 900;
const LOW = 0.45;
const HERO_AVATAR = spacing.xl * 3;

// A grey placeholder that pulses softly while content loads (UI pass), on the UI thread
export function Skeleton({ width = '100%', height = spacing.md, round = false }: { width?: DimensionValue; height?: number; round?: boolean }) {
  const styles = useStyles();
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(LOW, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.block, { width, height, borderRadius: round ? radii.pill : radii.sm }, pulse]} />;
}

// A card-shaped placeholder: a round badge, two lines and a wider line, like a feed post. bare:
// without the card around it, for a screen's own card (B8)
export function SkeletonCard({ bare = false }: { bare?: boolean } = {}) {
  const styles = useStyles();
  return (
    <View style={bare ? styles.bare : styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.row}>
        <Skeleton width={spacing.xl + spacing.xs} height={spacing.xl + spacing.xs} round />
        <View style={styles.lines}>
          <Skeleton width="45%" />
          <Skeleton width="25%" height={spacing.sm + spacing.xs} />
        </View>
      </View>
      <Skeleton width="70%" height={spacing.md + spacing.xs} />
    </View>
  );
}

// B8: Profile's header while it loads: a round avatar, the name, a line and a wide bar
export function SkeletonHero() {
  const styles = useStyles();
  return (
    <View style={[styles.card, styles.hero]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton width={HERO_AVATAR} height={HERO_AVATAR} round />
      <Skeleton width="40%" height={spacing.lg} />
      <Skeleton width="60%" />
      <Skeleton height={spacing.xl + spacing.md} />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  bare: {
    gap: spacing.sm + spacing.xs,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  block: {
    backgroundColor: colors.surfaceHigh,
  },
  card: {
    gap: spacing.sm + spacing.xs,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  lines: {
    flex: 1,
    gap: spacing.xs + spacing.xs / 2,
  },
}));

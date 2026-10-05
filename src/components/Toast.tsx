import { Bell } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOAST_VISIBLE_MS } from '@/shared/config';
import { useToastStore } from '@/state/toastStore';
import { makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;
const TILE_SIZE = spacing.xl + spacing.xs;

// The in-app toast (B2): a card under the status bar that eases down, stays TOAST_VISIBLE_MS and
// eases away; a tap hides it at once. Mounted once at the root, above every screen.
export function ToastHost() {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const current = useToastStore((state) => state.current);
  const hide = useToastStore((state) => state.hide);

  useEffect(() => {
    if (!current) return undefined;
    const timer = setTimeout(() => hide(current.key), TOAST_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [current, hide]);

  if (!current) return null;
  const Icon = current.icon ?? Bell;
  return (
    <View style={[styles.layer, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      <Animated.View
        key={current.key}
        entering={FadeInUp.duration(motion.cardMs).easing(Easing.out(Easing.cubic))}
        exiting={FadeOutUp.duration(motion.cardMs)}
      >
        <Pressable
          style={[styles.card, elevation.level3]}
          onPress={() => hide(current.key)}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <View style={styles.tile}>
            <Icon color={colors.primary} size={ICON_SIZE} />
          </View>
          <View style={styles.grow}>
            <Text style={typography.labelLg}>{current.title}</Text>
            {current.body ? <Text style={typography.bodySm}>{current.body}</Text> : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  layer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primaryContainer,
  },
  grow: {
    flex: 1,
  },
}));

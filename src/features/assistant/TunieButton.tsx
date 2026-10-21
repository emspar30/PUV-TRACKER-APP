import { useEffect } from 'react';
import { Image, Pressable, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const TUNIE = require('../../../assets/assistant/tunie-closeup.png');

// Larger than the other map buttons (48 dp), so Tunie stands out
const ROUND_SIZE = MIN_TOUCH_TARGET + spacing.sm + spacing.xs;
const RING = 2;
// The avatar's ring is white in both themes, as in Emjay's mock-ups (it frames the black close-up)
const RING_COLOR = '#ffffff';
// "Ask Tunie" opens this wide at most
const LABEL_MAX = spacing.xl * 4;

// CA1.1: Tunie's button on the Map, the last of the column: "Ask Tunie" with the avatar while
// nothing is shown under it, the round avatar alone while a card is (Emjay's rule); it slides
// between the two.
export function TunieButton({ expanded, onPress }: { expanded: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { typography, elevation } = useTheme();
  // From round when the Map first shows, so "Ask Tunie" slides open
  const open = useSharedValue(0);

  useEffect(() => {
    open.set(withTiming(expanded ? 1 : 0, { duration: motion.labelMs, easing: Easing.out(Easing.cubic) }));
  }, [expanded, open]);

  const labelStyle = useAnimatedStyle(() => ({
    maxWidth: open.get() * LABEL_MAX,
    opacity: open.get(),
    paddingLeft: open.get() * (spacing.sm + spacing.xs),
    paddingRight: open.get() * spacing.md,
  }));

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={strings.assistant.open}>
      <Animated.View style={[styles.pill, elevation.level3]}>
        <Image source={TUNIE} style={styles.avatar} accessibilityIgnoresInvertColors />
        <Animated.View style={[styles.label, labelStyle]}>
          <Text style={[typography.headlineSm, styles.text]} numberOfLines={1}>
            {strings.assistant.open}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.card,
  },
  avatar: {
    width: ROUND_SIZE,
    height: ROUND_SIZE,
    borderRadius: ROUND_SIZE / 2,
    borderWidth: RING,
    borderColor: RING_COLOR,
  },
  label: {
    overflow: 'hidden',
  },
  text: {
    color: colors.textPrimary,
  },
}));

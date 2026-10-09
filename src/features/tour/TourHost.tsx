import { usePathname } from 'expo-router';
import { Lightbulb, PartyPopper } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { TOUR_STEPS, placeBubble, type Size } from '@/shared/ui/tourPlacement';
import { showToast } from '@/state/toastStore';
import { useTourStore } from '@/state/tourStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const BUBBLE_MAX_WIDTH = 320;
const GAP = spacing.sm + spacing.xs;
const MARGIN = spacing.md;
const ARROW = spacing.md;
const ARROW_INSET = spacing.lg;
const RING_PAD = spacing.xs;
const RING_WIDTH = 3;
const ICON_SIZE = spacing.md + spacing.xs;
const DOT = spacing.sm - spacing.xs / 2;
const HALF = 2;

// ST2-D: the tips tour. A speech bubble beside one control at a time on the Map tab, with a ring
// round the control, the step count, Skip and Next. No backdrop: the rest of the screen stays as it
// is and can still be used. Shown over the Map tab only; it waits there if the rider goes elsewhere.
export function TourHost() {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  const window = useWindowDimensions();
  const pathname = usePathname();
  const step = useTourStore((state) => state.step);
  const targets = useTourStore((state) => state.targets);
  const next = useTourStore((state) => state.next);
  const finish = useTourStore((state) => state.finish);
  // The bubble's height depends on its text; it is placed once it has been measured
  const [measured, setMeasured] = useState<{ step: number; size: Size } | null>(null);

  if (step === null || pathname !== '/') return null;
  const id = TOUR_STEPS[step];
  const target = targets[id];
  if (!target) return null;

  const last = step === TOUR_STEPS.length - 1;
  const width = Math.min(BUBBLE_MAX_WIDTH, window.width - MARGIN * HALF);
  const size = measured?.step === step ? measured.size : null;
  const place = placeBubble(target, window, size ?? { width, height: 0 }, GAP, MARGIN, ARROW_INSET);
  const text = strings.tour.steps[id];

  const advance = () => {
    if (last) showToast({ icon: PartyPopper, title: strings.tour.done });
    next();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            left: target.x - RING_PAD,
            top: target.y - RING_PAD,
            width: target.width + RING_PAD * HALF,
            height: target.height + RING_PAD * HALF,
            borderRadius: Math.min(target.width, target.height) / HALF + RING_PAD,
          },
        ]}
      />
      <View
        style={[styles.bubble, elevation.level3, { left: place.left, top: place.top, width, opacity: size ? 1 : 0 }]}
        onLayout={(event) => setMeasured({ step, size: { width, height: event.nativeEvent.layout.height } })}
        accessibilityViewIsModal={false}
        accessibilityLiveRegion="polite"
      >
        <View style={[styles.arrow, place.below ? styles.arrowTop : styles.arrowBottom, { left: place.arrowLeft - ARROW / HALF }]} />
        <View style={styles.head}>
          <Lightbulb color={colors.onPrimary} size={ICON_SIZE} />
          <Text style={[typography.labelLg, styles.onBubble, styles.grow]} accessibilityRole="header">
            {text.title}
          </Text>
          <Text style={[typography.labelMd, styles.onBubble]}>{strings.tour.count(step + 1, TOUR_STEPS.length)}</Text>
        </View>
        <Text style={[typography.bodyMd, styles.onBubble]}>{text.body}</Text>
        <View style={styles.foot}>
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {TOUR_STEPS.map((stepId, index) => (
              <View key={stepId} style={[styles.dot, index <= step && styles.dotOn]} />
            ))}
          </View>
          {last ? null : (
            <Pressable style={styles.skip} onPress={finish} accessibilityRole="button" accessibilityLabel={strings.tour.skipLabel}>
              <Text style={[typography.labelLg, styles.onBubble]}>{strings.tour.skip}</Text>
            </Pressable>
          )}
          <Pressable style={styles.next} onPress={advance} accessibilityRole="button">
            <Text style={[typography.labelLg, styles.nextText]}>{last ? strings.tour.finish : strings.tour.next}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  ring: {
    position: 'absolute',
    borderWidth: RING_WIDTH,
    borderColor: colors.primary,
  },
  bubble: {
    position: 'absolute',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.primary,
  },
  arrow: {
    position: 'absolute',
    width: ARROW,
    height: ARROW,
    backgroundColor: colors.primary,
    transform: [{ rotate: '45deg' }],
  },
  arrowTop: {
    top: -ARROW / HALF + RING_WIDTH / HALF,
  },
  arrowBottom: {
    bottom: -ARROW / HALF + RING_WIDTH / HALF,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  onBubble: {
    color: colors.onPrimary,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT,
    backgroundColor: colors.onPrimary,
    opacity: 0.35,
  },
  dotOn: {
    opacity: 1,
  },
  skip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  next: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.onPrimary,
  },
  nextText: {
    color: colors.primary,
  },
}));

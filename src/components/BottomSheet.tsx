import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import {
  clampSheetHeight,
  nextSnap,
  releaseVelocity,
  sheetSnapHeights,
  sheetTopClearance,
  snapTarget,
  stepSnap,
  type SnapHeights,
  type SnapName,
} from '@/shared/ui/sheetSnap';
import { useSheetStore } from '@/state/sheetStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const HANDLE_WIDTH = spacing.xl;
const HANDLE_HEIGHT = spacing.xs;
const ICON_SIZE = spacing.md + spacing.xs;

// Development builds: what a drag ended with, to tune the snap rules on a device
function logRelease(heightDp: number, velocityUp: number, target: SnapName) {
  console.log(`[sheet] release at ${Math.round(heightDp)} dp, velocity ${Math.round(velocityUp)} dp/s -> ${target}`);
}

// Asks the sheet to move to a snap point. A new `key` repeats the move even to the same point.
export type SheetRequest = { key: number; snap: SnapName };

type BottomSheetProps = {
  // Remembers the last snap point under this name while the app is open
  id: string;
  defaultSnap?: SnapName;
  request?: SheetRequest | null;
  // Called after the sheet settles, and once when it first appears, with its visible height in dp
  onSnapChange?: (snap: SnapName, visibleHeight: number) => void;
  // Always visible: the content of the peek height, and a drag area together with the handle
  header: ReactNode;
  // Revealed as the sheet rises; scrolls only when the sheet is fully open
  children?: ReactNode;
  // Controls that float just above the sheet's top edge, such as a status pill or a map button.
  // They follow the edge while dragging and hide when the sheet is fully open.
  floating?: ReactNode;
};

// A sheet over a full-screen map that the user drags between three snap points: peek, half and
// expanded (docs/DESIGN.md). The map stays usable above it. Built only on the gesture and animation
// libraries already compiled into the app.
export function BottomSheet({ id, defaultSnap = 'peek', request, onSnapChange, header, children, floating }: BottomSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const remembered = useSheetStore((state) => state.snaps[id]);
  const remember = useSheetStore((state) => state.setSnap);

  const [containerHeight, setContainerHeight] = useState(0);
  // The snap point, with a counter so that settling on the same point again still re-runs the animation
  const [position, setPosition] = useState<{ snap: SnapName; seq: number }>({ snap: remembered ?? defaultSnap, seq: 0 });
  const snap = position.snap;
  const heights = useMemo<SnapHeights | null>(
    // Never cover the avatar button at the top right, so Settings opens from every snap point
    () =>
      containerHeight > 0
        ? sheetSnapHeights(containerHeight, sheetTopClearance(insets.top, MIN_TOUCH_TARGET, spacing.sm))
        : null,
    [containerHeight, insets.top],
  );

  // Visible height while dragging and animating, on the UI thread
  const height = useSharedValue(0);
  const startHeight = useSharedValue(0);
  const startTime = useSharedValue(0);
  // Speed of the finger at release, so the spring continues the flick
  const releaseSpeed = useSharedValue(0);

  // Below the open position the body cannot scroll, so it always shows its top
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (snap !== 'expanded') scroll.current?.scrollTo({ y: 0, animated: false });
  }, [snap]);

  const moveTo = useCallback((target: SnapName) => {
    setPosition((current) => ({ snap: target, seq: current.seq + 1 }));
  }, []);

  // A request from the screen, such as "open half way for this result". Handled while rendering,
  // so the new point shows in the same render.
  const [handledRequest, setHandledRequest] = useState(request?.key);
  if (request && request.key !== handledRequest) {
    setHandledRequest(request.key);
    setPosition((current) => ({ snap: request.snap, seq: current.seq + 1 }));
  }

  // Animate to the chosen point, remember it, and tell the screen how much of the map it covers.
  // The first placement after layout jumps straight there.
  useEffect(() => {
    if (!heights) return;
    const target = heights[position.snap];
    if (height.get() === 0) {
      height.set(target);
    } else {
      height.set(withSpring(target, { ...motion.sheetSpring, velocity: releaseSpeed.get() }));
      releaseSpeed.set(0);
    }
    remember(id, position.snap);
    onSnapChange?.(position.snap, target);
  }, [position, heights, height, releaseSpeed, remember, id, onSnapChange]);

  const makePan = useCallback(
    (enabled: boolean) =>
      Gesture.Pan()
        .enabled(enabled && heights !== null)
        .activeOffsetY([-motion.dragSlopDp, motion.dragSlopDp])
        .onStart(() => {
          startHeight.set(height.get());
          startTime.set(Date.now());
        })
        .onUpdate((event) => {
          if (!heights) return;
          height.set(clampSheetHeight(startHeight.get() - event.translationY, heights));
        })
        .onEnd((event) => {
          if (!heights) return;
          // Dragging up makes the sheet taller, so its growth speed is the opposite of the finger's y speed
          const velocity = releaseVelocity(-event.velocityY, height.get() - startHeight.get(), Date.now() - startTime.get());
          releaseSpeed.set(velocity);
          const target = snapTarget(height.get(), velocity, heights);
          if (__DEV__) scheduleOnRN(logRelease, height.get(), velocity, target);
          scheduleOnRN(moveTo, target);
        }),
    [heights, height, startHeight, startTime, releaseSpeed, moveTo],
  );

  // The handle and the header always drag. The body drags only while it cannot scroll.
  const handlePan = useMemo(() => makePan(true), [makePan]);
  const bodyPan = useMemo(() => makePan(snap !== 'expanded'), [makePan, snap]);

  const expandedHeight = heights?.expanded ?? 0;
  const sheetStyle = useAnimatedStyle(() => ({
    height: expandedHeight,
    transform: [{ translateY: expandedHeight - height.get() }],
  }));
  const floatingStyle = useAnimatedStyle(() => {
    const half = heights?.half ?? 0;
    const fadeEnd = heights ? (heights.half + heights.expanded) / 2 : 1;
    return {
      bottom: height.get() + spacing.sm,
      opacity: interpolate(height.get(), [half, fadeEnd], [1, 0], Extrapolation.CLAMP),
    };
  });

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') moveTo(stepSnap(snap, 'up'));
    if (event.nativeEvent.actionName === 'decrement') moveTo(stepSnap(snap, 'down'));
  };

  const ChevronIcon = snap === 'expanded' ? ChevronDown : ChevronUp;

  return (
    <View
      style={styles.root}
      pointerEvents="box-none"
      onLayout={(event: LayoutChangeEvent) => setContainerHeight(event.nativeEvent.layout.height)}
    >
      {heights && floating ? (
        <Animated.View
          style={[styles.floating, floatingStyle]}
          pointerEvents={snap === 'expanded' ? 'none' : 'box-none'}
        >
          {floating}
        </Animated.View>
      ) : null}

      {heights ? (
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <GestureDetector gesture={handlePan}>
            <View>
              <View
                style={styles.handleRow}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={strings.sheet.label}
                accessibilityValue={{ text: strings.sheet.position[snap] }}
                accessibilityActions={[
                  { name: 'increment', label: strings.sheet.expand },
                  { name: 'decrement', label: strings.sheet.collapse },
                ]}
                onAccessibilityAction={onAccessibilityAction}
              >
                <View style={styles.handle} />
              </View>
              <Pressable
                style={styles.chevron}
                onPress={() => moveTo(nextSnap(snap))}
                accessibilityRole="button"
                accessibilityLabel={strings.sheet.next}
                accessibilityValue={{ text: strings.sheet.position[snap] }}
                hitSlop={spacing.xs}
              >
                <ChevronIcon color={colors.textSecondary} size={ICON_SIZE} />
              </Pressable>
              <View style={styles.header}>{header}</View>
            </View>
          </GestureDetector>

          <GestureDetector gesture={bodyPan}>
            <ScrollView
              ref={scroll}
              style={styles.body}
              contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + spacing.lg }]}
              scrollEnabled={snap === 'expanded'}
              showsVerticalScrollIndicator={snap === 'expanded'}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </GestureDetector>
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  floating: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.sheet,
    ...elevation.level3,
  },
  // The drag handle: 4 x 32 dp, 8 dp from the top edge, in a full-width strip that is easy to grab
  handleRow: {
    height: spacing.lg,
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  handle: {
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: HANDLE_HEIGHT,
    backgroundColor: colors.outline,
  },
  chevron: {
    position: 'absolute',
    top: 0,
    right: spacing.sm,
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  header: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    paddingRight: MIN_TOUCH_TARGET + spacing.sm,
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
}));

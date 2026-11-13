import { useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { motion } from '@/theme';

// Tester note (2026-11-13): the keyboard's height for laying out a text box above it, from React
// Native's own keyboard events, which Android reports as the keyboard closes however it closes.
// Reanimated's useAnimatedKeyboard, used before, kept the old height after the keyboard went away
// when more than one screen listened at once, leaving the Relay panel lifted with no keyboard.
// The height is above the navigation bar (React Native subtracts the system bars). onShow runs each
// time the keyboard opens.
export function useKeyboardHeight(onShow?: () => void): SharedValue<number> {
  const height = useSharedValue(0);
  const onShowRef = useRef(onShow);
  useEffect(() => {
    onShowRef.current = onShow;
  }, [onShow]);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      height.set(withTiming(Math.max(0, event.endCoordinates.height), { duration: motion.cardMs }));
      onShowRef.current?.();
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => height.set(withTiming(0, { duration: motion.cardMs })));
    // Already open when this screen appears
    const metrics = Keyboard.isVisible() ? Keyboard.metrics() : undefined;
    if (metrics) height.set(metrics.height);
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [height]);

  return height;
}

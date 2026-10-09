import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { TOUR_STEPS, type TourStepId } from '@/shared/ui/tourPlacement';
import { useTourStore } from '@/state/tourStore';

// ST2-D: marks a control the tips tour points at. It reports where the control is on screen when it
// is laid out, and again when its step comes up (the cards round it may have moved since).
export function TourTarget({ id, children, style }: { id: TourStepId; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<View>(null);
  const setTarget = useTourStore((state) => state.setTarget);
  const active = useTourStore((state) => state.step !== null && TOUR_STEPS[state.step] === id);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setTarget(id, { x, y, width, height });
    });
  }, [id, setTarget]);

  useEffect(() => {
    if (active) measure();
  }, [active, measure]);

  return (
    <View ref={ref} collapsable={false} onLayout={measure} style={style}>
      {children}
    </View>
  );
}

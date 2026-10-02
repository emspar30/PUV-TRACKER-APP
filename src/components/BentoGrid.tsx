import { createContext, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { spacing, type Spacing } from '@/theme';

type BentoGridContextValue = {
  columns: number;
  columnWidth: number;
  gap: number;
};

const BentoGridContext = createContext<BentoGridContextValue | null>(null);

// Width of a tile spanning `span` columns, or undefined outside a measured grid
export function useBentoSpanWidth(span: number): number | undefined {
  const grid = useContext(BentoGridContext);
  if (!grid || grid.columnWidth === 0) return undefined;
  const clamped = Math.min(Math.max(span, 1), grid.columns);
  return grid.columnWidth * clamped + grid.gap * (clamped - 1);
}

type BentoGridProps = {
  columns?: number;
  gap?: Spacing;
  children?: ReactNode;
};

export function BentoGrid({ columns = 2, gap = 'md', children }: BentoGridProps) {
  const [width, setWidth] = useState(0);
  const gapSize = spacing[gap];
  const columnWidth = width > 0 ? (width - gapSize * (columns - 1)) / columns : 0;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <BentoGridContext.Provider value={{ columns, columnWidth, gap: gapSize }}>
      <View style={[styles.grid, { gap: gapSize }]} onLayout={onLayout}>
        {children}
      </View>
    </BentoGridContext.Provider>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

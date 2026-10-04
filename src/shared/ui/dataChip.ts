// The one data chip in a screen's header (AF1, AF2): "Demo" while simulated live data shows,
// otherwise "Sample data" while the route data is a placeholder, otherwise none.

export type DataChip = 'demo' | 'sample' | null;

export function headerDataChip({ demoShowing, isPlaceholder }: { demoShowing: boolean; isPlaceholder: boolean }): DataChip {
  if (demoShowing) return 'demo';
  return isPlaceholder ? 'sample' : null;
}

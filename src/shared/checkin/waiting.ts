// B3: Check-in shows every route's stations at once, so the waiting counts of several routes are
// merged per station. The larger count is kept, not the sum: one commuter checked in for two routes
// at a shared stop is counted by both. Pure: no React Native or Expo imports.

export function mergeWaiting(byRoute: readonly (ReadonlyMap<string, number> | null)[]): ReadonlyMap<string, number> | null {
  const known = byRoute.filter((counts): counts is ReadonlyMap<string, number> => counts !== null);
  if (known.length === 0) return null;
  const merged = new Map<string, number>();
  for (const counts of known) {
    for (const [station, count] of counts) merged.set(station, Math.max(merged.get(station) ?? 0, count));
  }
  return merged;
}

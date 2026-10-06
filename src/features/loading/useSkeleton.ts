import { useEffect, useState } from 'react';

// B8: true while a screen shows its skeleton: at least minMs after the screen first mounts, and
// until its data is ready. Tabs stay mounted, so it shows on the first visit only.
export function useSkeleton(minMs: number, ready = true): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), minMs);
    return () => clearTimeout(timer);
  }, [minMs]);
  return !elapsed || !ready;
}

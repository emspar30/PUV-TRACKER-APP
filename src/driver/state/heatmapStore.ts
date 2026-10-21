import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CLOCK_DRIFT_SAMPLES, DRIVER_RECENT_LOG_MAX } from '@/shared/config';
import { emptyHeatmap, type HeatmapState } from '@/shared/driver/heatmap';
import type { InboxRejectReason, ProcessedInbox } from '@/shared/driver/inbox';

// DR5: what the driver phone knows from its heatmap messages: the counts per stop (with the last
// sequence number and when the last one was accepted), the clock samples from the carrier's
// timestamps, counters of rejected messages by reason and a short log for the admin screen. Never
// a message body: the log keeps only the kind, the time, the outcome and the sequence number.

export type HeatmapLogEntry = {
  receivedMs: number;
  kind: 'data' | 'text';
  outcome: 'accepted' | InboxRejectReason;
  seq: number | null;
};

type Stored = {
  heatmap: HeatmapState | null;
  // Oldest first, at most CLOCK_DRIFT_SAMPLES
  driftSamples: number[];
  accepted: number;
  rejected: Partial<Record<InboxRejectReason, number>>;
  // Newest first, at most DRIVER_RECENT_LOG_MAX
  recent: HeatmapLogEntry[];
};

type HeatmapStoreState = Stored & {
  // The heatmap for this route, starting empty (or again empty after the route changed)
  ensureRoute: (route: string) => HeatmapState;
  record: (processed: ProcessedInbox) => void;
  resetHeatmap: () => void;
};

const DEFAULTS: Stored = { heatmap: null, driftSamples: [], accepted: 0, rejected: {}, recent: [] };

const deviceStorage = createJSONStorage<Stored>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function validHeatmap(value: unknown): HeatmapState | null {
  if (typeof value !== 'object' || value === null) return null;
  const h = value as Record<string, unknown>;
  if (typeof h.route !== 'string' || typeof h.counts !== 'object' || h.counts === null) return null;
  if (!(h.lastSeq === null || isNumber(h.lastSeq)) || !(h.lastAcceptedMs === null || isNumber(h.lastAcceptedMs))) return null;
  const counts: Record<string, number> = {};
  for (const [code, count] of Object.entries(h.counts as Record<string, unknown>)) {
    if (!isNumber(count)) return null;
    counts[code] = count;
  }
  return { route: h.route, counts, lastSeq: h.lastSeq as number | null, lastAcceptedMs: h.lastAcceptedMs as number | null };
}

function validLog(value: unknown): HeatmapLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (e): e is HeatmapLogEntry =>
        typeof e === 'object' &&
        e !== null &&
        isNumber(e.receivedMs) &&
        (e.kind === 'data' || e.kind === 'text') &&
        typeof e.outcome === 'string' &&
        (e.seq === null || isNumber(e.seq)),
    )
    .slice(0, DRIVER_RECENT_LOG_MAX);
}

function validCounters(value: unknown): Stored['rejected'] {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, count]) => isNumber(count))) as Stored['rejected'];
}

export const useHeatmapStore = create<HeatmapStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      ensureRoute: (route) => {
        const current = get().heatmap;
        if (current && current.route === route) return current;
        const fresh = emptyHeatmap(route);
        set({ heatmap: fresh });
        return fresh;
      },
      record: ({ state, results }) =>
        set((previous) => {
          const rejected = { ...previous.rejected };
          let accepted = previous.accepted;
          const drift = [...previous.driftSamples];
          const log: HeatmapLogEntry[] = [];
          for (const { entry, outcome, driftS } of results) {
            if (outcome.ok) accepted += 1;
            else rejected[outcome.reason] = (rejected[outcome.reason] ?? 0) + 1;
            if (driftS !== null) drift.push(driftS);
            log.push({ receivedMs: entry.receivedMs, kind: entry.kind, outcome: outcome.ok ? 'accepted' : outcome.reason, seq: outcome.ok ? outcome.seq : null });
          }
          return {
            heatmap: state,
            accepted,
            rejected,
            driftSamples: drift.slice(-CLOCK_DRIFT_SAMPLES),
            recent: [...log.reverse(), ...previous.recent].slice(0, DRIVER_RECENT_LOG_MAX),
          };
        }),
      resetHeatmap: () => set(DEFAULTS),
    }),
    {
      name: 'driver-heatmap',
      storage: deviceStorage,
      partialize: ({ heatmap, driftSamples, accepted, rejected, recent }) => ({ heatmap, driftSamples, accepted, rejected, recent }),
      // A damaged or old saved value falls back to empty, never to a half heatmap
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Record<keyof Stored, unknown>>;
        return {
          ...current,
          heatmap: validHeatmap(saved.heatmap),
          driftSamples: Array.isArray(saved.driftSamples) ? saved.driftSamples.filter(isNumber).slice(-CLOCK_DRIFT_SAMPLES) : [],
          accepted: isNumber(saved.accepted) ? saved.accepted : 0,
          rejected: validCounters(saved.rejected),
          recent: validLog(saved.recent),
        };
      },
    },
  ),
);

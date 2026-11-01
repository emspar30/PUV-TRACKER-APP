import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { FIELD_LOG_MAX_EVENTS, FIELD_LOG_RSSI_EVERY_S } from '@/shared/config';
import type { FieldEvent, FieldEventKind } from '@/shared/fieldtest/log';

const MS_PER_S = 1000;

// S10: the field test log, kept on this phone only (Menu, Demo and simulation, Field test log).
// Off until a tester turns it on; then the relay, the background task, the Bluetooth scan and the
// telemetry sender note their events (fieldLog). At most FIELD_LOG_MAX_EVENTS, the oldest dropped.
type StoredLog = { recording: boolean; events: FieldEvent[] };

type FieldLogState = StoredLog & {
  setRecording: (recording: boolean) => void;
  add: (event: FieldEvent) => void;
  clear: () => void;
};

const deviceStorage = createJSONStorage<StoredLog>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useFieldLogStore = create<FieldLogState>()(
  persist(
    (set) => ({
      recording: false,
      events: [],
      setRecording: (recording) => set({ recording }),
      add: (event) => set((state) => ({ events: [...state.events, event].slice(-FIELD_LOG_MAX_EVENTS) })),
      clear: () => set({ events: [] }),
    }),
    { name: 'field-log', storage: deviceStorage, partialize: ({ recording, events }) => ({ recording, events }) },
  ),
);

let lastRssiMs = 0;

// Notes an event while recording; does nothing otherwise. Bluetooth readings are thinned to one every
// FIELD_LOG_RSSI_EVERY_S, so a long ride does not fill the log.
export function fieldLog(kind: FieldEventKind, value?: number, note?: string): void {
  try {
    const store = useFieldLogStore.getState();
    if (!store.recording) return;
    const atMs = Date.now();
    if (kind === 'rssi') {
      if (atMs - lastRssiMs < FIELD_LOG_RSSI_EVERY_S * MS_PER_S) return;
      lastRssiMs = atMs;
    }
    store.add({ atMs, kind, ...(value === undefined ? {} : { value }), ...(note ? { note } : {}) });
  } catch {
    // The log must never break a relay
  }
}

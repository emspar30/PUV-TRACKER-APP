import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isHistoryEntry, keptHistory, withQuestion, type HistoryEntry } from '@/shared/assistant/history';
import type { Intent } from '@/shared/assistant/intent';

// CA1.1: Tunie's conversation (an hour at most), kept on this phone only. Also cleared by Reset app
// and Delete account.

type StoredAssistant = { entries: HistoryEntry[] };

type AssistantState = StoredAssistant & {
  ask: (question: string, intent: Intent, nowMs: number) => void;
  prune: (nowMs: number) => void;

};

const deviceStorage = createJSONStorage<StoredAssistant>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, get) => ({
      entries: [],

      ask: (question, intent, nowMs) => set({ entries: withQuestion(get().entries, question, intent, nowMs) }),
      prune: (nowMs) => {
        const kept = keptHistory(get().entries, nowMs);
        if (kept.length !== get().entries.length) set({ entries: kept });
      },

    }),
    {
      name: 'assistant',
      storage: deviceStorage,
      partialize: ({ entries }) => ({ entries }),
      // A broken or older save keeps only what can be read
      merge: (saved, current) => {
        const stored = (saved ?? {}) as Partial<StoredAssistant>;
        const entries = Array.isArray(stored.entries) ? stored.entries.filter(isHistoryEntry) : [];
        return { ...current, entries };
      },
    },
  ),
);

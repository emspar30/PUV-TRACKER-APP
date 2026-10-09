import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { TOUR_STEPS, type Rect, type TourStepId } from '@/shared/ui/tourPlacement';

// ST2-D: the tips tour. Whether it has been seen (stored on this device, so it starts by itself only
// once), the step showing, and where each control it points at is on screen.

type StoredTour = { done: boolean };

type TourState = StoredTour & {
  // Index into TOUR_STEPS while the tour shows; null otherwise
  step: number | null;
  targets: Partial<Record<TourStepId, Rect>>;
  start: () => void;
  next: () => void;
  // Skip and the last step both end the tour for good (Settings can replay it)
  finish: () => void;
  setTarget: (id: TourStepId, rect: Rect) => void;
};

const deviceStorage = createJSONStorage<StoredTour>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      done: false,
      step: null,
      targets: {},
      start: () => set({ step: 0 }),
      next: () => {
        const { step } = get();
        if (step === null) return;
        if (step >= TOUR_STEPS.length - 1) set({ step: null, done: true });
        else set({ step: step + 1 });
      },
      finish: () => set({ step: null, done: true }),
      setTarget: (id, rect) => {
        const known = get().targets[id];
        if (known && known.x === rect.x && known.y === rect.y && known.width === rect.width && known.height === rect.height) return;
        set({ targets: { ...get().targets, [id]: rect } });
      },
    }),
    {
      name: 'tour',
      storage: deviceStorage,
      partialize: ({ done }) => ({ done }),
      merge: (persisted, current) => ({ ...current, done: (persisted as Partial<StoredTour> | undefined)?.done === true }),
    },
  ),
);

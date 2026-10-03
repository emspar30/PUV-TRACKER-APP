import { create } from 'zustand';

import type { SnapName } from '@/shared/ui/sheetSnap';

// The last snap point of each screen's bottom sheet, kept while the app is open (not saved to disk)
type SheetState = {
  snaps: Record<string, SnapName>;
  setSnap: (id: string, snap: SnapName) => void;
};

export const useSheetStore = create<SheetState>((set) => ({
  snaps: {},
  setSnap: (id, snap) => set((state) => ({ snaps: { ...state.snaps, [id]: snap } })),
}));

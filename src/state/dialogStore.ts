import type { LucideIcon } from 'lucide-react-native';
import { create } from 'zustand';

// The app's own dialog, in place of the system alert (C1 UI pass): one at a time, shown by
// DialogHost at the root. A new dialog replaces the one showing.

export type DialogTone = 'primary' | 'success' | 'warning' | 'danger';

export type DialogAction = {
  label: string;
  // Runs after the dialog closes
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
};

export type DialogRequest = {
  tone: DialogTone;
  title: string;
  body: string;
  // Default: an icon for the tone
  icon?: LucideIcon;
  // Default: one "OK" button
  actions?: readonly DialogAction[];
};

type DialogState = {
  current: (DialogRequest & { key: number }) | null;
  show: (request: DialogRequest) => void;
  close: () => void;
};

export const useDialogStore = create<DialogState>((set) => ({
  current: null,
  show: (request) => set((state) => ({ current: { ...request, key: (state.current?.key ?? 0) + 1 } })),
  close: () => set({ current: null }),
}));

export const showDialog = (request: DialogRequest) => useDialogStore.getState().show(request);

import type { LucideIcon } from 'lucide-react-native';
import { create } from 'zustand';

// Short in-app notices (B2), such as "Your multicab is 500 m away": one at a time, shown by ToastHost
// at the root over every screen, gone after TOAST_VISIBLE_MS or a tap. A new toast replaces the one
// showing. In-app only: nothing reaches the phone's notification shade.

export type ToastRequest = {
  title: string;
  body?: string;
  icon?: LucideIcon;
};

type ToastState = {
  current: (ToastRequest & { key: number }) | null;
  show: (request: ToastRequest) => void;
  // Hides the toast only if it is still the one with this key
  hide: (key: number) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  current: null,
  show: (request) => set((state) => ({ current: { ...request, key: (state.current?.key ?? 0) + 1 } })),
  hide: (key) => set((state) => (state.current?.key === key ? { current: null } : state)),
}));

export const showToast = (request: ToastRequest) => useToastStore.getState().show(request);

import type { LucideIcon } from 'lucide-react-native';
import { create } from 'zustand';

import { useNotificationsStore } from './notificationsStore';

// Short in-app notices (B2), such as "Your multicab is 500 m away": one at a time, shown by ToastHost
// at the root over every screen, gone after TOAST_VISIBLE_MS or a tap. A new toast replaces the one
// showing. In-app only: nothing reaches the phone's notification shade. A toast marked `inbox` is
// also kept on the Notifications page.

export type ToastRequest = {
  title: string;
  body?: string;
  icon?: LucideIcon;
  // Kept on the Notifications page too (alerts and updates, not short notices about a tap)
  inbox?: boolean;
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

export function showToast(request: ToastRequest): void {
  useToastStore.getState().show(request);
  if (request.inbox) useNotificationsStore.getState().add(request.title, request.body ?? null, Date.now());
}

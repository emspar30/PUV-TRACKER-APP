import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { addToInbox, type InboxItem } from '@/shared/notifications/inbox';

// The Notifications page's list, kept on this phone between app starts. Filled by showToast for
// the toasts marked `inbox`; nothing here is sent anywhere.

type StoredNotifications = { items: InboxItem[] };

type NotificationsState = StoredNotifications & {
  add: (title: string, body: string | null, atMs: number) => void;
  clear: () => void;
};

const deviceStorage = createJSONStorage<StoredNotifications>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      items: [],
      add: (title, body, atMs) => set((state) => ({ items: addToInbox(state.items, { id: `${atMs}-${title}`, title, body, atMs }) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'notifications',
      storage: deviceStorage,
      partialize: ({ items }) => ({ items }),
    },
  ),
);

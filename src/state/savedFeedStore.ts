import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FeedPost } from '@/shared/demo/feed';
import { feedToSave, isSavedPost, type SavedFeed } from '@/shared/feed/saved';

// The last live Crowdsource feed that loaded (shared/feed/saved), kept on this phone only, so the
// reports still show offline or after reopening the app. Cleared by Reset app and Delete account.

type SavedFeedState = SavedFeed & {
  save: (posts: readonly FeedPost[], nowMs: number) => void;
};

const deviceStorage = createJSONStorage<SavedFeed>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useSavedFeedStore = create<SavedFeedState>()(
  persist(
    (set) => ({
      posts: [],
      savedMs: null,

      save: (posts, nowMs) => set(feedToSave(posts, nowMs)),
    }),
    {
      name: 'saved-feed',
      storage: deviceStorage,
      partialize: ({ posts, savedMs }) => ({ posts, savedMs }),
      // A broken or older save keeps only what can be read
      merge: (saved, current) => {
        const stored = (saved ?? {}) as Partial<SavedFeed>;
        const posts = Array.isArray(stored.posts) ? stored.posts.filter(isSavedPost) : [];
        const savedMs = typeof stored.savedMs === 'number' ? stored.savedMs : null;
        return { ...current, posts, savedMs };
      },
    },
  ),
);

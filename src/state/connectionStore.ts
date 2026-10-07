import { create } from 'zustand';

// PRD 14: whether the server answered the last check. Null until checked, with Demo data on, or
// without a backend; the offline banner shows only on false. Not saved.
type ConnectionState = { online: boolean | null };

export const useConnectionStore = create<ConnectionState>(() => ({ online: null }));

export function setOnline(online: boolean | null): void {
  if (useConnectionStore.getState().online !== online) useConnectionStore.setState({ online });
}

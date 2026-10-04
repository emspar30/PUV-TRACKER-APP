// Backlog 68: open a resource again only after closing the copy opened before, so a reload (Fast
// Refresh, "Try again") never leaves an old native database handle behind next to the new one.
// The holder is kept by the caller (on globalThis, so it survives a Fast Refresh of the module).

export type Closable = { closeAsync(): Promise<void> };

export type Holder<T> = { current: T | null };

export async function reopen<T extends Closable>(holder: Holder<T>, open: () => Promise<T>): Promise<T> {
  const previous = holder.current;
  holder.current = null;
  if (previous) {
    try {
      await previous.closeAsync();
    } catch {
      // An already closed or broken handle is what this replaces; opening again is still right
    }
  }
  const next = await open();
  holder.current = next;
  return next;
}

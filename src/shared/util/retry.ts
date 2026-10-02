export type RetryOptions = {
  // Total number of tries, including the first
  attempts: number;
  delayMs: number;
  // Only errors this returns true for are retried; any other error is thrown at once
  shouldRetry: (error: unknown) => boolean;
  // Replaceable in tests so they do not really wait
  sleep?: (ms: number) => Promise<void>;
};

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Runs `task`, trying again after a pause when it fails with an error worth retrying.
// Throws the last error if every attempt fails.
export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { attempts, delayMs, shouldRetry, sleep = realSleep } = options;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !shouldRetry(error)) throw error;
      await sleep(delayMs);
    }
  }
  throw lastError;
}

// SQLite reports a database another connection is still writing to as "locked" or "busy"
export function isDatabaseLockedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /database is locked|database table is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(message);
}

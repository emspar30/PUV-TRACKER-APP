import { isDatabaseLockedError, withRetry } from '../util/retry';

const noWait = async () => {};

describe('withRetry', () => {
  it('returns the result when the first try works', async () => {
    const task = jest.fn(async () => 'ok');
    await expect(withRetry(task, { attempts: 3, delayMs: 10, shouldRetry: () => true, sleep: noWait })).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('tries again after a retryable failure and waits between tries', async () => {
    const sleep = jest.fn(noWait);
    let calls = 0;
    const task = async () => {
      calls += 1;
      if (calls < 3) throw new Error('database is locked');
      return 'seeded';
    };
    await expect(
      withRetry(task, { attempts: 5, delayMs: 250, shouldRetry: isDatabaseLockedError, sleep }),
    ).resolves.toBe('seeded');
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it('gives up after the last attempt and throws the last error', async () => {
    const task = jest.fn(async () => {
      throw new Error('database is locked');
    });
    await expect(
      withRetry(task, { attempts: 4, delayMs: 1, shouldRetry: isDatabaseLockedError, sleep: noWait }),
    ).rejects.toThrow('database is locked');
    expect(task).toHaveBeenCalledTimes(4);
  });

  it('does not retry an error that is not worth retrying', async () => {
    const task = jest.fn(async () => {
      throw new Error('no such table: stations');
    });
    await expect(
      withRetry(task, { attempts: 4, delayMs: 1, shouldRetry: isDatabaseLockedError, sleep: noWait }),
    ).rejects.toThrow('no such table');
    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe('isDatabaseLockedError', () => {
  it('recognises the message seen on a first launch', () => {
    expect(
      isDatabaseLockedError(
        new Error("Call to function 'NativeDatabase.execAsync' has been rejected.\n→ Caused by: database is locked"),
      ),
    ).toBe(true);
    expect(isDatabaseLockedError(new Error('SQLITE_BUSY'))).toBe(true);
    expect(isDatabaseLockedError('database is locked')).toBe(true);
  });

  it('does not match other database errors', () => {
    expect(isDatabaseLockedError(new Error('no such table: stations'))).toBe(false);
    expect(isDatabaseLockedError(new Error('disk full'))).toBe(false);
  });
});

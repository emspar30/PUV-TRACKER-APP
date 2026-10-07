// PRD 15.1, D10 and PRD 14: account deletion and the server check, with the backend client faked.
// The live delete is not run: it would remove the shared test account.

import { deleteMyAccount } from '../auth';
import { serverReachable } from '../connection';

const mockCalls: string[] = [];
let mockRpcError: { message: string } | null = null;

jest.mock('../supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    rpc: async (name: string) => {
      mockCalls.push(`rpc:${name}`);
      return { error: mockRpcError };
    },
    auth: {
      signOut: async ({ scope }: { scope: string }) => {
        mockCalls.push(`signOut:${scope}`);
        return { error: null };
      },
    },
  }),
}));

beforeEach(() => {
  mockCalls.length = 0;
  mockRpcError = null;
});

describe('Delete account (PRD 15.1, D10)', () => {
  it('deletes on the server first, then drops the session on this phone only', async () => {
    expect(await deleteMyAccount()).toEqual({ ok: true });
    expect(mockCalls).toEqual(['rpc:delete_my_account', 'signOut:local']);
  });

  it('keeps the session when the server refuses or cannot be reached, so nothing is cleared', async () => {
    mockRpcError = { message: 'network request failed' };
    expect(await deleteMyAccount()).toEqual({ ok: false, message: 'network request failed' });
    expect(mockCalls).toEqual(['rpc:delete_my_account']);
  });
});

describe('server check for the offline banner (PRD 14)', () => {
  const realFetch = global.fetch;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  beforeAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  });
  afterAll(() => {
    global.fetch = realFetch;
    process.env.EXPO_PUBLIC_SUPABASE_URL = url;
  });

  it('any answer, even an error status, is online', async () => {
    global.fetch = jest.fn(async () => new Response(null, { status: 401 })) as typeof fetch;
    expect(await serverReachable()).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/health', expect.anything());
  });

  it('a failed request is offline', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    expect(await serverReachable()).toBe(false);
  });

  it('no answer within the timeout is offline', async () => {
    global.fetch = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    ) as typeof fetch;
    expect(await serverReachable(10)).toBe(false);
  });
});

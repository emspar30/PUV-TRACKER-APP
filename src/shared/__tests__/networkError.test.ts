import { isNetworkFailure } from '../util/networkError';

describe('isNetworkFailure', () => {
  it('knows the texts of a request that never reached the server', () => {
    expect(isNetworkFailure('TypeError: Network request failed')).toBe(true);
    expect(isNetworkFailure('Error: java.net.UnknownHostException: Unable to resolve host "x.supabase.co"')).toBe(true);
    expect(isNetworkFailure('java.net.SocketTimeoutException: timeout')).toBe(true);
    expect(isNetworkFailure('Failed to fetch')).toBe(true);
  });

  it('leaves server answers and missing messages alone', () => {
    expect(isNetworkFailure('not enough energy')).toBe(false);
    expect(isNetworkFailure('duplicate key value violates unique constraint')).toBe(false);
    expect(isNetworkFailure(undefined)).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });
});

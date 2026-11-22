// Device ban (PRD 10.3): the phone sends its Android ID once per signed-in account; the server keeps a
// keyed HMAC of it. Here: when the app sends it, and that a failure lets the next sign-in try again.

const mockRpc = jest.fn();

jest.mock('expo-application', () => ({ getAndroidId: () => 'dd96dec43fb81c97' }));
// The test runner is not Android; the phone is
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../supabase', () => ({ getSupabase: () => ({ rpc: mockRpc }), isSupabaseConfigured: () => true }));

function load() {
  let device: typeof import('../device') | undefined;
  jest.isolateModules(() => {
    device = jest.requireActual('../device');
  });
  return device!;
}

beforeEach(() => mockRpc.mockReset());

describe('registering the phone for the device ban', () => {
  it('sends the Android ID once per account', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    const { registerDevice } = load();
    await registerDevice('user-a');
    await registerDevice('user-a');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('register_device', { android_id: 'dd96dec43fb81c97' });
    await registerDevice('user-b');
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('sends nothing while signed out, and tries again after a failure', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } }).mockResolvedValueOnce({ data: false, error: null });
    const { registerDevice } = load();
    await registerDevice(null);
    expect(mockRpc).not.toHaveBeenCalled();
    await registerDevice('user-a');
    await registerDevice('user-a');
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});

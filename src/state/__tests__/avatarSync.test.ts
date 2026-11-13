// 2026-11-13 (Emjay): the preset avatar follows the account. The server's avatar wins on sign-in; a
// phone uploads only when the server has none, or when the rider picks one themselves.

const mockSaved = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockSaved.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockSaved.set(key, value),
    removeItemSync: (key: string) => mockSaved.delete(key),
  },
}));

const mockServer: { avatar: number | null; saves: number[] } = { avatar: null, saves: [] };
jest.mock('@/services/profile', () => ({
  loadAvatarId: async () => mockServer.avatar,
  saveAvatarId: async (id: number) => {
    mockServer.saves.push(id);
    mockServer.avatar = id;
    return true;
  },
}));

// eslint-disable-next-line import/first
import { avatarChosen, stopAvatarSync, syncAvatar } from '../avatarSync';
// eslint-disable-next-line import/first
import { useProfileStore } from '../profileStore';

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  stopAvatarSync();
  mockServer.avatar = null;
  mockServer.saves = [];
  useProfileStore.setState({ avatarId: 0, avatarAssigned: false });
});

describe('avatar sync', () => {
  it('a second phone shows the avatar saved by the first, not its own random draw', async () => {
    mockServer.avatar = 12;
    useProfileStore.setState({ avatarId: 3, avatarAssigned: true });
    await syncAvatar();
    expect(useProfileStore.getState()).toMatchObject({ avatarId: 12, avatarAssigned: true });
    expect(mockServer.saves).toEqual([]);
  });

  it('the first phone saves its avatar when the server has none', async () => {
    useProfileStore.setState({ avatarId: 7, avatarAssigned: true });
    await syncAvatar();
    expect(mockServer.saves).toEqual([7]);
  });

  it('saves nothing before the phone has an avatar', async () => {
    await syncAvatar();
    expect(mockServer.saves).toEqual([]);
  });

  it('a pick by the rider is saved, and wins over the server when made before it was read', async () => {
    mockServer.avatar = 12;
    await syncAvatar();
    useProfileStore.setState({ avatarId: 4, avatarAssigned: true });
    avatarChosen();
    await flush();
    expect(mockServer.saves).toEqual([4]);

    stopAvatarSync();
    useProfileStore.setState({ avatarId: 9, avatarAssigned: true });
    avatarChosen();
    await syncAvatar();
    expect(mockServer.saves).toEqual([4, 9]);
    expect(useProfileStore.getState().avatarId).toBe(9);
  });
});

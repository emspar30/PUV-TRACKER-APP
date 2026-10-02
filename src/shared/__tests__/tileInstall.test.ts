import { TileInstallError, installTiles, tileFileName, type TileFiles, type TilesetInfo } from '../map/tileInstall';

const TILESET: TilesetInfo = { id: 'butuan', version: 2, bytes: 1000 };
const NAME = 'butuan.v2.pmtiles';
const PART = `${NAME}.part`;

type FakeOptions = {
  // Bytes the bundled copy writes; defaults to the full size
  copiedBytes?: number;
  failCopy?: boolean;
  failRename?: boolean;
};

function fakeFiles(initial: Record<string, number>, options: FakeOptions = {}) {
  const store = new Map<string, number>(Object.entries(initial));
  let copies = 0;
  const files: TileFiles = {
    sizeOf: (name) => store.get(name) ?? null,
    list: () => [...store.keys()],
    remove: (name) => {
      store.delete(name);
    },
    copyBundledTo: async (name) => {
      copies += 1;
      if (options.failCopy) {
        // A copy that dies part-way leaves a short file behind
        store.set(name, 10);
        throw new Error('disk full');
      }
      store.set(name, options.copiedBytes ?? TILESET.bytes);
    },
    rename: async (from, to) => {
      if (options.failRename) throw new Error('rename failed');
      store.set(to, store.get(from)!);
      store.delete(from);
    },
  };
  return { files, store, copyCount: () => copies };
}

describe('tile file name', () => {
  it('carries the tile set id and version', () => {
    expect(tileFileName(TILESET)).toBe(NAME);
  });
});

describe('installTiles', () => {
  it('copies the bundled file on a fresh install', async () => {
    const { files, store, copyCount } = fakeFiles({});
    await expect(installTiles(files, TILESET)).resolves.toBe('installed');
    expect(store.get(NAME)).toBe(TILESET.bytes);
    expect(store.has(PART)).toBe(false);
    expect(copyCount()).toBe(1);
  });

  it('does not copy again when the installed file has the right size', async () => {
    const { files, copyCount } = fakeFiles({ [NAME]: TILESET.bytes });
    await expect(installTiles(files, TILESET)).resolves.toBe('already-installed');
    expect(copyCount()).toBe(0);
  });

  it('replaces an installed file of the wrong size', async () => {
    const { files, store, copyCount } = fakeFiles({ [NAME]: 400 });
    await expect(installTiles(files, TILESET)).resolves.toBe('installed');
    expect(store.get(NAME)).toBe(TILESET.bytes);
    expect(copyCount()).toBe(1);
  });

  it('replaces an older version and removes it after the new copy is in place', async () => {
    const { files, store } = fakeFiles({ 'butuan.v1.pmtiles': 900, 'butuan.pmtiles': 900 });
    await expect(installTiles(files, TILESET)).resolves.toBe('installed');
    expect([...store.keys()]).toEqual([NAME]);
  });

  it('removes older versions even when the current one is already installed', async () => {
    const { files, store } = fakeFiles({ [NAME]: TILESET.bytes, 'butuan.v1.pmtiles': 900 });
    await installTiles(files, TILESET);
    expect([...store.keys()]).toEqual([NAME]);
  });

  it('leaves files of other tile sets alone', async () => {
    const { files, store } = fakeFiles({ 'cebu.v1.pmtiles': 500 });
    await installTiles(files, TILESET);
    expect(store.get('cebu.v1.pmtiles')).toBe(500);
  });

  it('recovers from a leftover partial file of an interrupted copy', async () => {
    const { files, store } = fakeFiles({ [PART]: 10 });
    await expect(installTiles(files, TILESET)).resolves.toBe('installed');
    expect(store.get(NAME)).toBe(TILESET.bytes);
    expect(store.has(PART)).toBe(false);
  });

  it('reports a failed copy, leaves no partial file, and succeeds on a retry', async () => {
    const failing = fakeFiles({}, { failCopy: true });
    await expect(installTiles(failing.files, TILESET)).rejects.toBeInstanceOf(TileInstallError);
    expect(failing.store.size).toBe(0);

    const retry = fakeFiles(Object.fromEntries(failing.store));
    await expect(installTiles(retry.files, TILESET)).resolves.toBe('installed');
  });

  it('rejects a copy that is shorter than the bundled file', async () => {
    const { files, store } = fakeFiles({}, { copiedBytes: 999 });
    await expect(installTiles(files, TILESET)).rejects.toThrow('incomplete (999 of 1000 bytes)');
    expect(store.has(NAME)).toBe(false);
    expect(store.has(PART)).toBe(false);
  });

  it('never leaves a short file under the final name when the last step fails', async () => {
    const { files, store } = fakeFiles({}, { failRename: true });
    await expect(installTiles(files, TILESET)).rejects.toBeInstanceOf(TileInstallError);
    expect(store.has(NAME)).toBe(false);
    expect(store.has(PART)).toBe(false);
  });

  it('keeps a failed install of a new version from deleting the working old one', async () => {
    const { files, store } = fakeFiles({ 'butuan.v1.pmtiles': 900 }, { failCopy: true });
    await expect(installTiles(files, TILESET)).rejects.toBeInstanceOf(TileInstallError);
    expect(store.get('butuan.v1.pmtiles')).toBe(900);
  });
});

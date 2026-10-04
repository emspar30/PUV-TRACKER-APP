import {
  GlyphInstallError,
  glyphFilePath,
  glyphsUrl,
  installGlyphs,
  type GlyphFile,
  type GlyphFiles,
  type GlyphSetInfo,
} from '../map/glyphInstall';

// A fixed two-file glyph set, not the bundled one
const GLYPHS: GlyphSetInfo = {
  version: 2,
  files: [
    { font: 'Test Sans Regular', range: '0-255', bytes: 100 },
    { font: 'Test Sans Regular', range: '256-511', bytes: 200 },
  ],
};

type FakeOptions = { shortCopy?: boolean; failCopy?: boolean };

function fakeFiles(initial: Record<string, number>, folders: string[] = [], options: FakeOptions = {}) {
  const store = new Map<string, number>(Object.entries(initial));
  const topFolders = new Set(folders);
  const copied: string[] = [];
  const files: GlyphFiles = {
    sizeOf: (path) => store.get(path) ?? null,
    listFolders: () => [...topFolders],
    removeFolder: (name) => {
      topFolders.delete(name);
      for (const key of [...store.keys()]) if (key.startsWith(`${name}/`)) store.delete(key);
    },
    remove: (path) => {
      store.delete(path);
    },
    makeFolder: (path) => {
      topFolders.add(path.split('/')[0]);
    },
    copyBundledTo: async (file: GlyphFile, path) => {
      copied.push(path);
      if (options.failCopy) throw new Error('disk full');
      store.set(path, options.shortCopy ? file.bytes - 1 : file.bytes);
    },
    rename: async (from, to) => {
      store.set(to, store.get(from)!);
      store.delete(from);
    },
  };
  return { files, store, topFolders, copied };
}

describe('glyph paths', () => {
  it('put each font and range under the versioned folder', () => {
    expect(glyphFilePath(GLYPHS, GLYPHS.files[0])).toBe('glyphs-v2/Test Sans Regular/0-255.pbf');
  });

  it('give MapLibre a file:// template with {fontstack} and {range}', () => {
    const root = 'file:///data/user/0/com.tunton.app/files/glyphs';
    expect(glyphsUrl(root, GLYPHS)).toBe(`${root}/glyphs-v2/{fontstack}/{range}.pbf`);
    expect(glyphsUrl(`${root}/`, GLYPHS)).toBe(`${root}/glyphs-v2/{fontstack}/{range}.pbf`);
  });
});

describe('installGlyphs', () => {
  it('copies every file on a fresh install, through a temporary name', async () => {
    const { files, store, copied } = fakeFiles({});
    await expect(installGlyphs(files, GLYPHS)).resolves.toEqual({ result: 'installed', copied: 2 });
    expect(copied.every((path) => path.endsWith('.part'))).toBe(true);
    expect(store.get('glyphs-v2/Test Sans Regular/0-255.pbf')).toBe(100);
    expect(store.get('glyphs-v2/Test Sans Regular/256-511.pbf')).toBe(200);
    expect([...store.keys()].some((key) => key.endsWith('.part'))).toBe(false);
  });

  it('copies nothing when every file is already there at the right size', async () => {
    const { files, copied } = fakeFiles({
      'glyphs-v2/Test Sans Regular/0-255.pbf': 100,
      'glyphs-v2/Test Sans Regular/256-511.pbf': 200,
    });
    await expect(installGlyphs(files, GLYPHS)).resolves.toEqual({ result: 'already-installed', copied: 0 });
    expect(copied).toEqual([]);
  });

  it('replaces only a file of the wrong size', async () => {
    const { files, store, copied } = fakeFiles({
      'glyphs-v2/Test Sans Regular/0-255.pbf': 100,
      'glyphs-v2/Test Sans Regular/256-511.pbf': 7,
    });
    await expect(installGlyphs(files, GLYPHS)).resolves.toEqual({ result: 'installed', copied: 1 });
    expect(copied).toEqual(['glyphs-v2/Test Sans Regular/256-511.pbf.part']);
    expect(store.get('glyphs-v2/Test Sans Regular/256-511.pbf')).toBe(200);
  });

  it('removes older glyph versions after installing, and leaves other folders alone', async () => {
    const { files, topFolders } = fakeFiles({ 'glyphs-v1/Test Sans Regular/0-255.pbf': 90 }, ['glyphs-v1', 'other']);
    await installGlyphs(files, GLYPHS);
    expect([...topFolders].sort()).toEqual(['glyphs-v2', 'other']);
  });

  it('fails with a clear error on a short copy and leaves no partial file', async () => {
    const { files, store } = fakeFiles({}, [], { shortCopy: true });
    await expect(installGlyphs(files, GLYPHS)).rejects.toThrow(GlyphInstallError);
    expect([...store.keys()]).toEqual([]);
  });

  it('wraps a failed copy in a GlyphInstallError', async () => {
    const { files } = fakeFiles({}, [], { failCopy: true });
    await expect(installGlyphs(files, GLYPHS)).rejects.toThrow('Could not copy the label font Test Sans Regular 0-255.');
  });
});

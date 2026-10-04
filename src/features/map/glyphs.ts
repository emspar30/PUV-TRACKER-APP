import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

import { GLYPHSET, GLYPH_FONT_MEDIUM, GLYPH_FONT_REGULAR } from '@/data/map/glyphset';
import { glyphsUrl, installGlyphs, type GlyphFile, type GlyphFiles, type GlyphInstallResult } from '@/shared/map/glyphInstall';

import medium0 from '../../../assets/glyphs/glyphs-v1/Noto Sans Medium/0-255.pbf';
import medium256 from '../../../assets/glyphs/glyphs-v1/Noto Sans Medium/256-511.pbf';
import medium8192 from '../../../assets/glyphs/glyphs-v1/Noto Sans Medium/8192-8447.pbf';
import regular0 from '../../../assets/glyphs/glyphs-v1/Noto Sans Regular/0-255.pbf';
import regular256 from '../../../assets/glyphs/glyphs-v1/Noto Sans Regular/256-511.pbf';
import regular8192 from '../../../assets/glyphs/glyphs-v1/Noto Sans Regular/8192-8447.pbf';

const GLYPH_ROOT = 'glyphs';

// The bundled module for each font and range in GLYPHSET
const BUNDLED: Record<string, number> = {
  [`${GLYPH_FONT_REGULAR}/0-255`]: regular0,
  [`${GLYPH_FONT_REGULAR}/256-511`]: regular256,
  [`${GLYPH_FONT_REGULAR}/8192-8447`]: regular8192,
  [`${GLYPH_FONT_MEDIUM}/0-255`]: medium0,
  [`${GLYPH_FONT_MEDIUM}/256-511`]: medium256,
  [`${GLYPH_FONT_MEDIUM}/8192-8447`]: medium8192,
};

export type OfflineGlyphs = {
  // Style glyph template for the installed files (file://)
  url: string;
  install: GlyphInstallResult;
};

function glyphRoot(): Directory {
  const root = new Directory(Paths.document, GLYPH_ROOT);
  if (!root.exists) root.create({ intermediates: true, idempotent: true });
  return root;
}

function deviceGlyphFiles(root: Directory): GlyphFiles {
  const fileAt = (path: string) => new File(root, ...path.split('/'));
  return {
    sizeOf: (path) => {
      const file = fileAt(path);
      return file.exists ? file.size : null;
    },
    listFolders: () => root.list().filter((entry) => entry instanceof Directory).map((entry) => entry.name),
    removeFolder: (name) => new Directory(root, name).delete(),
    remove: (path) => fileAt(path).delete(),
    makeFolder: (path) => {
      const folder = new Directory(root, ...path.split('/'));
      if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
    },
    copyBundledTo: async (file: GlyphFile, path) => {
      const module = BUNDLED[`${file.font}/${file.range}`];
      if (module === undefined) throw new Error(`No bundled glyph file for ${file.font} ${file.range}`);
      // In a development build this fetches the file from the dev server; in a release build it is inside the app
      const asset = await Asset.fromModule(module).downloadAsync();
      if (!asset.localUri) throw new Error('The bundled glyph file could not be read.');
      await new File(asset.localUri).copy(fileAt(path));
    },
    rename: async (from, to) => {
      await fileAt(from).move(fileAt(to));
    },
  };
}

// Makes sure the label glyphs are in the app's private storage and returns the style's glyph URL.
// Throws GlyphInstallError; the map then simply draws without text.
export async function prepareOfflineGlyphs(): Promise<OfflineGlyphs> {
  const root = glyphRoot();
  const startedMs = Date.now();
  const install = await installGlyphs(deviceGlyphFiles(root), GLYPHSET);
  if (__DEV__) {
    console.log(`[glyphs] ${install.result} (${install.copied} files) in ${Date.now() - startedMs} ms`);
  }
  return { url: glyphsUrl(root.uri, GLYPHSET), install };
}

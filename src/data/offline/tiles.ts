import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

import { pmtilesUrl } from '@/data/map/offlineStyle';
import { TILESET } from '@/data/map/tileset';
import {
  TileInstallError,
  installTiles,
  tileFileName,
  type TileFiles,
  type TileInstallResult,
} from '@/shared/map/tileInstall';

import bundledTiles from '../../../assets/map/butuan_v2.pmtiles';

import { prepareOfflineGlyphs } from './glyphs';

// DR5: here, not in src/features/map, because the driver app's static heatmap map uses it too and
// the driver app may not import commuter features (PRD 6.2; eslint.config.js)
const TILE_FOLDER = 'map';

export type OfflineTiles = {
  // Style source URL for the installed tile file
  url: string;
  install: TileInstallResult;
  // Style glyph template for the installed label fonts, or null if they could not be installed (LB1a)
  glyphsUrl: string | null;
};

function tileFolder(): Directory {
  const folder = new Directory(Paths.document, TILE_FOLDER);
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  return folder;
}

function deviceTileFiles(folder: Directory): TileFiles {
  const fileAt = (name: string) => new File(folder, name);
  return {
    sizeOf: (name) => {
      const file = fileAt(name);
      return file.exists ? file.size : null;
    },
    list: () => folder.list().map((entry) => entry.name),
    remove: (name) => fileAt(name).delete(),
    copyBundledTo: async (name) => {
      // In a development build this fetches the file from the dev server; in a release build it is inside the app
      const asset = await Asset.fromModule(bundledTiles).downloadAsync();
      if (!asset.localUri) throw new TileInstallError('The bundled offline map could not be read.');
      await new File(asset.localUri).copy(fileAt(name));
    },
    rename: async (from, to) => {
      await fileAt(from).move(fileAt(to));
    },
  };
}

// Makes sure the offline tile set is in the app's private storage and returns where it is.
// Throws TileInstallError; the caller shows the message and offers a retry.
export async function prepareOfflineTiles(): Promise<OfflineTiles> {
  const folder = tileFolder();
  const startedMs = Date.now();
  const install = await installTiles(deviceTileFiles(folder), TILESET);
  if (__DEV__) {
    const files = folder.list().map((entry) => entry.name).join(', ');
    console.log(`[tiles] ${install} ${tileFileName(TILESET)} in ${Date.now() - startedMs} ms; files: ${files}`);
  }
  return { url: pmtilesUrl(new File(folder, tileFileName(TILESET)).uri), install, glyphsUrl: await glyphsOrNull() };
}

// The map works without text, so a glyph problem is logged and never blocks the map
async function glyphsOrNull(): Promise<string | null> {
  try {
    return (await prepareOfflineGlyphs()).url;
  } catch (error) {
    if (__DEV__) console.warn('[glyphs] not installed:', error instanceof Error ? error.message : error);
    return null;
  }
}

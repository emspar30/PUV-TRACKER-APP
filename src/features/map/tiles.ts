import { Asset } from 'expo-asset';

import { toPmtilesUrl } from '@/shared/map/offlineStyle';

import tileSet from '../../../assets/map/butuan.pmtiles';

let pending: Promise<string> | null = null;

async function copyTileSet(): Promise<string> {
  // Copies the bundled tile set to a file on the device, once; later calls reuse that file
  const asset = await Asset.fromModule(tileSet).downloadAsync();
  if (!asset.localUri) {
    throw new Error('The offline tile set has no local file');
  }
  return toPmtilesUrl(asset.localUri);
}

// The pmtiles:// URL of the on-device tile set. Safe to call from several screens.
export function prepareTiles(): Promise<string> {
  if (!pending) {
    pending = copyTileSet().catch((error: unknown) => {
      // Let the next call try again
      pending = null;
      throw error;
    });
  }
  return pending;
}

// Decides whether the bundled offline tile set must be copied into app storage, and copies it safely.
// Pure logic: the file operations are passed in, so this runs and is tested without a device.

export type TilesetInfo = {
  id: string;
  version: number;
  bytes: number;
};

// File operations on the app's tile folder. Names are plain file names inside that folder.
export type TileFiles = {
  // Size in bytes, or null if the file does not exist
  sizeOf(name: string): number | null;
  list(): string[];
  remove(name: string): void;
  // Copy the tile set that ships inside the app to the given name
  copyBundledTo(name: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
};

export type TileInstallResult = 'already-installed' | 'installed';

export class TileInstallError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TileInstallError';
  }
}

const PART_SUFFIX = '.part';

// The version is part of the name, so a new app version installs beside the old copy and then removes it
export function tileFileName(tileset: TilesetInfo): string {
  return `${tileset.id}.v${tileset.version}.pmtiles`;
}

export async function installTiles(files: TileFiles, tileset: TilesetInfo): Promise<TileInstallResult> {
  const name = tileFileName(tileset);

  if (files.sizeOf(name) === tileset.bytes) {
    removeStale(files, tileset, name);
    return 'already-installed';
  }

  // A file of the wrong size is a broken or interrupted copy
  removeIfPresent(files, name);

  // Copy under a temporary name first, so an interrupted copy can never be mistaken for a good file
  const part = name + PART_SUFFIX;
  removeIfPresent(files, part);
  try {
    await files.copyBundledTo(part);
  } catch (cause) {
    removeQuietly(files, part);
    throw new TileInstallError('Could not copy the offline map into app storage.', { cause });
  }

  const copied = files.sizeOf(part);
  if (copied !== tileset.bytes) {
    removeQuietly(files, part);
    throw new TileInstallError(`The offline map copy is incomplete (${copied ?? 0} of ${tileset.bytes} bytes).`);
  }

  try {
    await files.rename(part, name);
  } catch (cause) {
    removeQuietly(files, part);
    throw new TileInstallError('Could not finish installing the offline map.', { cause });
  }

  removeStale(files, tileset, name);
  return 'installed';
}

function removeIfPresent(files: TileFiles, name: string): void {
  if (files.sizeOf(name) !== null) files.remove(name);
}

// Cleanup must never hide the original problem or fail a good install
function removeQuietly(files: TileFiles, name: string): void {
  try {
    removeIfPresent(files, name);
  } catch {
    // ignored on purpose
  }
}

// Older versions and leftover partial files of the same tile set
function removeStale(files: TileFiles, tileset: TilesetInfo, keep: string): void {
  for (const other of files.list()) {
    if (other !== keep && other.startsWith(`${tileset.id}.`)) removeQuietly(files, other);
  }
}

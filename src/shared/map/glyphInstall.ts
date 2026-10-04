// Copies the bundled label glyphs (one small file per font and character range) into app storage,
// in a folder named after the glyph set version, and removes older versions afterwards (LB1a).
// Pure logic: the file operations are passed in, so this runs and is tested without a device.

export type GlyphFile = {
  font: string;
  range: string;
  bytes: number;
};

export type GlyphSetInfo = {
  version: number;
  files: readonly GlyphFile[];
};

// File operations under the app's glyph root. Paths are relative to that root, with "/" between parts.
export type GlyphFiles = {
  sizeOf(path: string): number | null;
  // Folder names directly under the root
  listFolders(): string[];
  removeFolder(name: string): void;
  remove(path: string): void;
  makeFolder(path: string): void;
  copyBundledTo(file: GlyphFile, path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
};

export type GlyphInstallResult = { result: 'already-installed' | 'installed'; copied: number };

export class GlyphInstallError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GlyphInstallError';
  }
}

const FOLDER_PREFIX = 'glyphs-v';
const PART_SUFFIX = '.part';

export function glyphFolderName(glyphs: GlyphSetInfo): string {
  return `${FOLDER_PREFIX}${glyphs.version}`;
}

export function glyphFilePath(glyphs: GlyphSetInfo, file: GlyphFile): string {
  return `${glyphFolderName(glyphs)}/${file.font}/${file.range}.pbf`;
}

// The style's glyph template. MapLibre fills in {fontstack} and {range}.
export function glyphsUrl(rootUri: string, glyphs: GlyphSetInfo): string {
  const root = rootUri.endsWith('/') ? rootUri : `${rootUri}/`;
  return `${root}${glyphFolderName(glyphs)}/{fontstack}/{range}.pbf`;
}

export async function installGlyphs(files: GlyphFiles, glyphs: GlyphSetInfo): Promise<GlyphInstallResult> {
  const folder = glyphFolderName(glyphs);
  let copied = 0;

  for (const file of glyphs.files) {
    const path = glyphFilePath(glyphs, file);
    if (files.sizeOf(path) === file.bytes) continue;
    if (files.sizeOf(path) !== null) files.remove(path);

    files.makeFolder(`${folder}/${file.font}`);
    // Copy under a temporary name first, so an interrupted copy is never mistaken for a good file
    const part = path + PART_SUFFIX;
    removeQuietly(files, part);
    try {
      await files.copyBundledTo(file, part);
    } catch (cause) {
      removeQuietly(files, part);
      throw new GlyphInstallError(`Could not copy the label font ${file.font} ${file.range}.`, { cause });
    }
    const size = files.sizeOf(part);
    if (size !== file.bytes) {
      removeQuietly(files, part);
      throw new GlyphInstallError(`The label font copy is incomplete (${size ?? 0} of ${file.bytes} bytes).`);
    }
    try {
      await files.rename(part, path);
    } catch (cause) {
      removeQuietly(files, part);
      throw new GlyphInstallError('Could not finish installing the label fonts.', { cause });
    }
    copied += 1;
  }

  for (const other of files.listFolders()) {
    if (other !== folder && other.startsWith(FOLDER_PREFIX)) {
      try {
        files.removeFolder(other);
      } catch {
        // An old folder left behind is harmless; it is tried again next launch
      }
    }
  }
  return { result: copied === 0 ? 'already-installed' : 'installed', copied };
}

function removeQuietly(files: GlyphFiles, path: string): void {
  try {
    if (files.sizeOf(path) !== null) files.remove(path);
  } catch {
    // ignored on purpose
  }
}

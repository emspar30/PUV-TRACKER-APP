// PRD 7.1 and 19 (D3, D4): the fare classification, the gender answer, the avatar and the frequent
// destinations stay on the device. These checks fail if code
// that talks to a server, or the server code itself, ever starts to mention them.

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|sql|json)$/.test(entry.name) ? [full] : [];
  });
}

// Source text with comments removed, so a comment that explains the rule does not break it
const code = (file: string) =>
  fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)(\/\/|--).*$/gm, '');

const mentions = (pattern: RegExp) => (file: string) => pattern.test(code(file));

describe('no cloud payload contains classification', () => {
  it('code that talks to the backend never mentions the classification, gender, avatar or destinations', () => {
    const files = sourceFiles(path.join(ROOT, 'src', 'services'));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter(mentions(/classification|avatar|onboard|gender|destination|landmark/i))).toEqual([]);
  });

  it('server code and migrations never mention the classification, gender, avatar or destinations', () => {
    const files = sourceFiles(path.join(ROOT, 'supabase'));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter(mentions(/classification|avatar|gender|destination|landmark/i))).toEqual([]);
  });

  it('the profile store keeps it on the device: it imports no service or network code', () => {
    const store = fs.readFileSync(path.join(ROOT, 'src', 'state', 'profileStore.ts'), 'utf8');
    const imports = [...store.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports).toEqual(expect.arrayContaining(['expo-sqlite/kv-store']));
    expect(imports.filter((source) => /services|supabase|fetch|http/i.test(source))).toEqual([]);
  });

  it('the destinations store keeps them on the device: it imports no service or network code', () => {
    const store = fs.readFileSync(path.join(ROOT, 'src', 'state', 'destinationsStore.ts'), 'utf8');
    const imports = [...store.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports).toEqual(expect.arrayContaining(['expo-sqlite/kv-store']));
    expect(imports.filter((source) => /services|supabase|fetch|http/i.test(source))).toEqual([]);
  });

  it('no file that imports a service or the backend client also reads the profile or destinations', () => {
    const offenders = sourceFiles(path.join(ROOT, 'src'))
      .filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`))
      .filter((file) => {
        const source = fs.readFileSync(file, 'utf8');
        const talksToBackend = /from '[^']*(services\/|@supabase)/.test(source);
        const readsPrivate =
          /from '[^']*(profileStore|destinationsStore|landmarks\.placeholder|profile\/avatarPick|profile\/destinations)'/.test(source);
        return talksToBackend && readsPrivate;
      })
      .map((file) => path.relative(ROOT, file).split(path.sep).join('/'));
    expect(offenders).toEqual([]);
  });

  it('location (merge of b21b0c1): one file reads the GPS, the fix is never saved, and no backend code reads it', () => {
    const sources = sourceFiles(path.join(ROOT, 'src')).filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`));
    const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');
    const readsGps = sources.filter((file) => /from 'expo-location'/.test(fs.readFileSync(file, 'utf8'))).map(rel);
    expect(readsGps).toEqual(['src/services/location.ts']);

    const store = fs.readFileSync(path.join(ROOT, 'src', 'state', 'locationStore.ts'), 'utf8');
    expect(store).not.toMatch(/persist|kv-store|AsyncStorage|services|supabase|fetch/);

    const backend = sources
      .filter((file) => /from '[^']*(services\/(supabase|auth|telemetry)|@supabase)/.test(fs.readFileSync(file, 'utf8')))
      .filter((file) => /locationStore|services\/location'/.test(fs.readFileSync(file, 'utf8')))
      .map(rel);
    expect(backend).toEqual([]);
  });

  it('the session store, which does talk to the backend, does not read the profile store', () => {
    const session = fs.readFileSync(path.join(ROOT, 'src', 'state', 'sessionStore.ts'), 'utf8');
    const imports = [...session.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports.filter((source) => /profileStore/.test(source))).toEqual([]);
  });

  it('only the avatar button, the settings and the intro import the avatar', () => {
    const offenders = sourceFiles(path.join(ROOT, 'src'))
      .filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`))
      .filter((file) => /from '[^']*features\/profile\/Avatar(Picker)?'|from '\.\/Avatar(Picker)?'/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file).split(path.sep).join('/'))
      .sort();
    // The avatar button (top right of each tab, a native view outside the map), the Settings sheet
    // and the introduction. None of them is drawn on the map or talks to a server.
    expect(offenders).toEqual([
      'src/app/onboarding.tsx',
      'src/app/settings.tsx',
      'src/components/AvatarButton.tsx',
      'src/features/profile/AvatarPicker.tsx',
    ]);
  });
});

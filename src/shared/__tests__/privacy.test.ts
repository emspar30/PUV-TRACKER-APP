// PRD 7.1: the fare classification and the avatar stay on the device. These checks fail if code
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
  it('code that talks to the backend never mentions the classification or the avatar', () => {
    const files = sourceFiles(path.join(ROOT, 'src', 'services'));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter(mentions(/classification|avatar|onboard/i))).toEqual([]);
  });

  it('server code and migrations never mention the classification or the avatar', () => {
    const files = sourceFiles(path.join(ROOT, 'supabase'));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter(mentions(/classification|avatar/i))).toEqual([]);
  });

  it('the profile store keeps it on the device: it imports no service or network code', () => {
    const store = fs.readFileSync(path.join(ROOT, 'src', 'state', 'profileStore.ts'), 'utf8');
    const imports = [...store.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports).toEqual(expect.arrayContaining(['expo-sqlite/kv-store']));
    expect(imports.filter((source) => /services|supabase|fetch|http/i.test(source))).toEqual([]);
  });

  it('the session store, which does talk to the backend, does not read the profile store', () => {
    const session = fs.readFileSync(path.join(ROOT, 'src', 'state', 'sessionStore.ts'), 'utf8');
    const imports = [...session.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports.filter((source) => /profileStore/.test(source))).toEqual([]);
  });

  it('no file outside the profile screens imports the avatar', () => {
    const offenders = sourceFiles(path.join(ROOT, 'src'))
      .filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`))
      .filter((file) => /from '[^']*features\/profile\/Avatar(Picker)?'|from '\.\/Avatar(Picker)?'/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file).split(path.sep).join('/'))
      .sort();
    expect(offenders).toEqual([
      'src/app/(tabs)/profile.tsx',
      'src/app/onboarding.tsx',
      'src/features/profile/AvatarPicker.tsx',
    ]);
  });
});

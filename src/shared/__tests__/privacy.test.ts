// PRD 7.1: the fare classification stays on the device. These checks fail if code that talks
// to a server, or the server code itself, ever starts to mention it.

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

const mentions = (file: string) => /classification/i.test(fs.readFileSync(file, 'utf8'));

describe('no cloud payload contains classification', () => {
  it('code that talks to the backend never mentions the classification', () => {
    const files = sourceFiles(path.join(ROOT, 'src', 'services'));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter(mentions)).toEqual([]);
  });

  it('server code and migrations never mention the classification', () => {
    expect(sourceFiles(path.join(ROOT, 'supabase')).filter(mentions)).toEqual([]);
  });

  it('the profile store keeps it on the device: it imports no service or network code', () => {
    const store = fs.readFileSync(path.join(ROOT, 'src', 'state', 'profileStore.ts'), 'utf8');
    const imports = [...store.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports).toEqual(expect.arrayContaining(['expo-sqlite/kv-store']));
    expect(imports.filter((source) => /services|supabase|fetch|http/i.test(source))).toEqual([]);
  });
});

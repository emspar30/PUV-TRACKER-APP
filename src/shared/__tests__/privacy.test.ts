import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// PRD 7.1: the fare classification stays on the device and is never sent to the cloud.
// Code that talks to the cloud lives in src/services and supabase/, so neither may mention it.
const ROOT = join(__dirname, '..', '..', '..');
const CLOUD_CODE = ['src/services', 'supabase'];

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|sql)$/.test(name) ? [path] : [];
  });
}

describe('no cloud payload contains classification', () => {
  it('no file in cloud-facing code refers to the classification', () => {
    const files = CLOUD_CODE.flatMap((dir) => sourceFiles(join(ROOT, dir)));
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.filter((file) => /classification|discount/i.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

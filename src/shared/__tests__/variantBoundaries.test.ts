// DR1: each app's bundle holds only what its screens import, directly or through other files.
// The driver channel is one-way (PRD 6.2) and the gateway talks only to the SMS worker, so neither
// may reach the Supabase client or the commuter app's services, even through a shared component
// (the components barrel once pulled the top bar, and with it the session, into the driver app).
// Lint catches direct imports; this walks the whole import graph from each app's routes.

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.join(__dirname, '..', '..', '..');
const SRC = path.join(ROOT, 'src');
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

function filesIn(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : filesIn(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

// Import specifiers of a file: import/export ... from 'x', import 'x', require('x'), import('x')
function specifiers(file: string): string[] {
  const text = fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const found: string[] = [];
  const patterns = [/\bfrom\s+'([^']+)'/g, /\bimport\s+'([^']+)'/g, /\brequire\(\s*'([^']+)'\s*\)/g, /\bimport\(\s*'([^']+)'\s*\)/g];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/') ? path.join(SRC, specifier.slice(2)) : path.resolve(path.dirname(from), specifier);
  if (/\.tsx?$/.test(base) && fs.existsSync(base)) return base;
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// Every source file and every package reachable from the given entry files
function reach(entries: string[]): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    for (const specifier of specifiers(file)) {
      if (specifier.startsWith('@/') || specifier.startsWith('.')) {
        const target = resolveLocal(file, specifier);
        if (target) queue.push(target);
      } else {
        packages.add(specifier);
      }
    }
  }
  return { files, packages };
}

const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');
const inside = (folder: string) => (file: string) => relative(file).startsWith(folder);

const driver = reach(filesIn(path.join(SRC, 'driver', 'app')));
const gateway = reach(filesIn(path.join(SRC, 'gateway', 'app')));
const commuter = reach(filesIn(path.join(SRC, 'app')));

describe('variant boundaries (DR1)', () => {
  it.each([
    ['driver', driver],
    ['gateway', gateway],
  ])('the %s app never reaches the cloud or the commuter app', (_name, graph) => {
    expect(graph.files.size).toBeGreaterThan(1);
    const cloudPackages = [...graph.packages].filter((name) => name.startsWith('@supabase/'));
    const forbidden = [...graph.files].filter(
      (file) =>
        inside('src/services/')(file) ||
        inside('src/data/live/')(file) ||
        inside('src/app/')(file) ||
        relative(file) === 'src/state/sessionStore.ts',
    );
    expect(cloudPackages).toEqual([]);
    expect(forbidden.map(relative)).toEqual([]);
  });

  it('the driver and gateway apps never reach each other', () => {
    expect([...driver.files].filter(inside('src/gateway/')).map(relative)).toEqual([]);
    expect([...gateway.files].filter(inside('src/driver/')).map(relative)).toEqual([]);
  });

  it('the commuter app never reaches the driver or gateway app', () => {
    expect(commuter.files.size).toBeGreaterThan(1);
    const crossed = [...commuter.files].filter((file) => inside('src/driver/')(file) || inside('src/gateway/')(file));
    expect(crossed.map(relative)).toEqual([]);
  });
});

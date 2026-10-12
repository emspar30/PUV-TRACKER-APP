import * as fs from 'node:fs';
import * as path from 'node:path';

// DR4: the Kotlin beacon test (modules/tunton-beacon/android/src/test) reads its own copy of the
// shared vectors. Both copies must hold the same vectors, so Kotlin, TypeScript and SQL are checked
// against one truth. Compared as JSON: git may change the line endings of either file.
const ROOT = path.join(__dirname, '..', '..', '..');
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

describe('beacon vectors copy (DR4)', () => {
  it('the Kotlin test resource equals tests/fixtures/beacon-vectors.json', () => {
    expect(read('modules/tunton-beacon/android/src/test/resources/beacon-vectors.json')).toEqual(read('tests/fixtures/beacon-vectors.json'));
  });
});

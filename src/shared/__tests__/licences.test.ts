// LB1: the full font licence and its copyright notice ship inside the app (SIL OFL 1.1), generated from
// the text file beside the fonts; the two must never drift apart.

import * as fs from 'node:fs';
import * as path from 'node:path';

import { FONT_LICENCE_TEXT } from '../../data/licences/fontLicence.generated';

const OFL = path.join(__dirname, '..', '..', '..', 'assets', 'glyphs', 'glyphs-v1', 'OFL.txt');

describe('font licence in the app', () => {
  it('contains the copyright line and the licence title', () => {
    expect(FONT_LICENCE_TEXT).toContain('Copyright 2022 The Noto Project Authors');
    expect(FONT_LICENCE_TEXT).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('is exactly the text file shipped beside the fonts (run scripts/generate-font-licence.ts after a change)', () => {
    expect(FONT_LICENCE_TEXT).toBe(fs.readFileSync(OFL, 'utf8').replace(/\r\n/g, '\n'));
  });
});

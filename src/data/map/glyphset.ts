// Facts about the label glyphs that ship with the app (assets/glyphs/glyphs-v1/), LB1a.
// Noto Sans glyph PBFs from Protomaps basemaps-assets, SIL Open Font License 1.1 (licence in
// assets/glyphs/glyphs-v1/OFL.txt; sources and SHA-256 in docs/LABELS_PLAN.md).
// When a file changes, update its `bytes` and bump `version` so installed copies are replaced.
// Pure data: no React Native or Expo imports.

import type { GlyphSetInfo } from '../../shared/map/glyphInstall';

export const GLYPH_FONT_REGULAR = 'Noto Sans Regular';
export const GLYPH_FONT_MEDIUM = 'Noto Sans Medium';

export const GLYPHSET: GlyphSetInfo = {
  version: 1,
  files: [
    { font: GLYPH_FONT_REGULAR, range: '0-255', bytes: 76044 },
    { font: GLYPH_FONT_REGULAR, range: '256-511', bytes: 127726 },
    { font: GLYPH_FONT_REGULAR, range: '8192-8447', bytes: 64220 },
    { font: GLYPH_FONT_MEDIUM, range: '0-255', bytes: 77628 },
    { font: GLYPH_FONT_MEDIUM, range: '256-511', bytes: 129635 },
    { font: GLYPH_FONT_MEDIUM, range: '8192-8447', bytes: 65101 },
  ],
};

// The LB1a test label: Butuan city centre (near City Hall), development builds only
export const LABEL_PROOF = { text: 'Butuan', lon: 125.5436, lat: 8.9475 };

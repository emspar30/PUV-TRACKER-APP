// MapLibre messages the app expects and does not show. The bundled label fonts hold only the Latin
// ranges (GLYPHSET, kept small for the app size); a place name with a symbol from another range,
// such as № or ★, makes MapLibre report that range as missing. The symbol is left out and the rest
// of the label is drawn, so the message is not an error for this app. Every other message is shown.
// Pure: no React Native or Expo imports.

const MISSING_GLYPH_RANGE = /^\{[^}]*\}\[Style\]: Failed to load glyph range \d+-\d+ for font stack /;

export function isExpectedMapLog(message: string): boolean {
  return MISSING_GLYPH_RANGE.test(message);
}

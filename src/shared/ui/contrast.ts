// WCAG 2 contrast ratio between two opaque colours given as #RRGGBB.
// Used by a unit test that checks every text colour of the theme against its backgrounds.

const HEX_RE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX_BASE = 16;
const CHANNEL_MAX = 255;
// Constants of the WCAG relative-luminance formula
const LINEAR_LIMIT = 0.03928;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA = 2.4;
const RED_WEIGHT = 0.2126;
const GREEN_WEIGHT = 0.7152;
const BLUE_WEIGHT = 0.0722;
const FLARE = 0.05;

// Normal-size text needs at least this ratio to meet WCAG AA
export const WCAG_AA_TEXT = 4.5;

export function relativeLuminance(hex: string): number {
  const match = HEX_RE.exec(hex);
  if (!match) throw new RangeError(`Not a #RRGGBB colour: ${hex}`);
  const [red, green, blue] = match.slice(1).map((channel) => {
    const value = parseInt(channel, HEX_BASE) / CHANNEL_MAX;
    return value <= LINEAR_LIMIT ? value / LINEAR_DIVISOR : ((value + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA;
  });
  return RED_WEIGHT * red + GREEN_WEIGHT * green + BLUE_WEIGHT * blue;
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + FLARE) / (Math.min(a, b) + FLARE);
}

import {
  BASE_MAPS,
  FEED_BADGES,
  LIGHT_ROUTE_COLORS,
  MAP_PAINTS,
  PALETTES,
  ROUTE_BADGE_TEXT,
  TEXT_PAIRS,
  routeColor,
  type MapPaint,
  type ThemeScheme,
} from '../../theme/tokens';
import { MAP_GEOMETRY } from '../../theme/theme';
import { WCAG_AA_GRAPHICS, WCAG_AA_TEXT, contrastRatio, relativeLuminance } from '../ui/contrast';

const SCHEMES: ThemeScheme[] = ['light', 'dark'];
// Route colours as stored with the route data, used as the dark-theme colours. Fixed values here,
// so this test does not depend on the live seed file.
const R4_STORED = '#00F5D4';
const STORED: Readonly<Record<string, string>> = { R3: '#10B981', R4: R4_STORED, R5: '#F97316' };

// The colour seen where a semi-transparent line lies over the map
function blend(top: string, bottom: string, opacity: number): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = [channels(top), channels(bottom)];
  return '#' + a.map((value, i) => Math.round(value * opacity + b[i] * (1 - opacity)).toString(16).padStart(2, '0')).join('');
}

describe('contrast ratio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 9);
  });

  it('rejects anything that is not #RRGGBB', () => {
    expect(() => contrastRatio('red', '#000000')).toThrow(RangeError);
    expect(() => contrastRatio('#FFF', '#000000')).toThrow(RangeError);
  });
});

describe.each(SCHEMES)('%s theme', (scheme) => {
  const colors = PALETTES[scheme];
  const land = BASE_MAPS[scheme].land;
  const paint = MAP_PAINTS[scheme];

  it.each(TEXT_PAIRS.map(([text, background]) => [text, background]))(
    'text %s on %s meets 4.5:1',
    (text, background) => {
      expect(contrastRatio(colors[text], colors[background])).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    },
  );

  // Graphical objects on the map: 3:1 against the land colour
  const graphics: (keyof MapPaint)[] = [
    'tripRide',
    'tripOrigin',
    'tripDestination',
    'stopSelected',
    'occupancyGreen',
    'occupancyAmber',
    'occupancyRed',
    'stale',
    'locationDot',
  ];
  it.each(graphics)('map %s meets 3:1 on the land colour', (token) => {
    expect(contrastRatio(paint[token], land)).toBeGreaterThanOrEqual(WCAG_AA_GRAPHICS);
  });

  it('a stop dot stands out from the land by its fill or its outline', () => {
    const best = Math.max(contrastRatio(paint.stop, land), contrastRatio(paint.stopStroke, land));
    expect(best).toBeGreaterThanOrEqual(WCAG_AA_GRAPHICS);
  });

  it.each(Object.keys(STORED))('%s: the return arrows stand out from the semi-transparent return band', (code) => {
    const band = blend(routeColor(scheme, code, STORED[code]), land, MAP_GEOMETRY.returnBandOpacity);
    expect(contrastRatio(paint.returnArrow, band)).toBeGreaterThanOrEqual(WCAG_AA_GRAPHICS);
  });

  it.each(Object.keys(STORED))('%s: the line meets 3:1 on the map, and badge text 4.5:1 on the route colour', (code) => {
    const route = routeColor(scheme, code, STORED[code]);
    expect(contrastRatio(route, land)).toBeGreaterThanOrEqual(WCAG_AA_GRAPHICS);
    expect(contrastRatio(ROUTE_BADGE_TEXT[scheme], route)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it('the map credit is readable on its pill', () => {
    expect(contrastRatio(colors.textSecondary, colors.surface)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});

describe('route colours', () => {
  it('dark mode uses the stored colour; light mode uses the theme colour for the route code', () => {
    expect(routeColor('dark', 'R4', R4_STORED)).toBe(R4_STORED);
    expect(routeColor('light', 'R4', R4_STORED)).toBe(LIGHT_ROUTE_COLORS.R4);
  });

  it('a route without a light colour falls back to its stored colour', () => {
    expect(routeColor('light', 'R99', '#123456')).toBe('#123456');
  });

  it('records why the stored Route 4 colour cannot be used on the light map', () => {
    expect(contrastRatio(R4_STORED, BASE_MAPS.light.land)).toBeLessThan(WCAG_AA_GRAPHICS);
  });
});

describe('feed badges (N1)', () => {
  it.each(['light', 'dark'] as const)('%s: every initial reaches AA on its fill', (scheme) => {
    for (const { fill, ink } of FEED_BADGES[scheme]) {
      expect([fill, ink, contrastRatio(ink, fill) >= WCAG_AA_TEXT]).toEqual([fill, ink, true]);
    }
  });
});

describe('DESIGN.md colours changed for contrast, kept on record', () => {
  it('the original amber text fails on its own fill, the replacement passes', () => {
    expect(contrastRatio('#ea8600', '#fef7e0')).toBeLessThan(WCAG_AA_TEXT);
    expect(contrastRatio(PALETTES.light.warning, PALETTES.light.warningContainer)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it('the original tertiary text fails on the grey surfaces, the replacement passes', () => {
    expect(contrastRatio('#747775', '#f1f3f4')).toBeLessThan(WCAG_AA_TEXT);
    expect(contrastRatio(PALETTES.light.textTertiary, PALETTES.light.surfaceHigh)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});

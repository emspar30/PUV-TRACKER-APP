import { colors } from '../../theme';
import { WCAG_AA_TEXT, contrastRatio, relativeLuminance } from '../ui/contrast';

// Colours the app uses for text, and the backgrounds text sits on
const TEXT_COLOURS = ['textPrimary', 'textMuted', 'cyan', 'amber', 'danger', 'emerald'] as const;
const BACKGROUNDS = ['canvas', 'surface'] as const;

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

describe('theme text colours meet WCAG AA (4.5:1) on both backgrounds', () => {
  const pairs = TEXT_COLOURS.flatMap((text) => BACKGROUNDS.map((background) => [text, background] as const));

  it.each(pairs)('%s on %s', (text, background) => {
    const ratio = contrastRatio(colors[text], colors[background]);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it('records why crimson is not a text colour', () => {
    expect(contrastRatio(colors.crimson, colors.surface)).toBeLessThan(WCAG_AA_TEXT);
  });
});

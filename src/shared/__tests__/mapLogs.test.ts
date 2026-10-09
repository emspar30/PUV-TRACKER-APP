import { isExpectedMapLog } from '../map/mapLogs';

describe('expected MapLibre messages', () => {
  it('quiets a glyph range outside the bundled fonts, for either font', () => {
    expect(isExpectedMapLog('{RenderThread 11}[Style]: Failed to load glyph range 9728-9983 for font stack Noto Sans Regular:( )')).toBe(true);
    expect(isExpectedMapLog('{RenderThread 69}[Style]: Failed to load glyph range 8448-8703 for font stack Noto Sans Medium:( )')).toBe(true);
  });

  it('shows every other message', () => {
    expect(isExpectedMapLog('{RenderThread 11}[Style]: Failed to load source basemap')).toBe(false);
    expect(isExpectedMapLog('Failed to load glyph range 0-255')).toBe(false);
    expect(isExpectedMapLog('')).toBe(false);
  });
});

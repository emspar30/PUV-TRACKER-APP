// LB1b: label tiers, fonts, names, dimming and contrast (text on its halo, 4.5:1, Light and Dark).

import { GLYPHSET } from '../../data/map/glyphset';
import { LABEL_LAYER_IDS, labelLayers } from '../../data/map/labelLayers';
import { OFFLINE_SOURCE_ID } from '../../data/map/offlineStyle';
import { BASE_MAPS, MAP_LABELS } from '../../theme/tokens';
import { LABEL_DIMMED_OPACITY } from '../config';
import { WCAG_AA_TEXT, contrastRatio } from '../ui/contrast';

describe.each(['light', 'dark'] as const)('map labels, %s', (scheme) => {
  const layers = labelLayers(MAP_LABELS[scheme], false);
  const byId = Object.fromEntries(layers.map((layer) => [layer.id, layer]));

  it('has the four tiers at zoom 11, 13, 13 and 15', () => {
    expect(layers.map((layer) => [layer.id, layer.minzoom])).toEqual([
      ['label-city', 11],
      ['label-barangay', 13],
      ['label-major-road', 13],
      ['label-street', 15],
    ]);
    expect(layers.map((layer) => layer.id)).toEqual([...LABEL_LAYER_IDS]);
  });

  it('reads only the offline tile source, places and roads', () => {
    for (const layer of layers) expect(layer.source).toBe(OFFLINE_SOURCE_ID);
    expect(byId['label-city']['source-layer']).toBe('places');
    expect(byId['label-street']['source-layer']).toBe('roads');
    expect(JSON.stringify(layers)).not.toMatch(/https?:\/\//);
  });

  it('uses the local name, then name:en, in a bundled font', () => {
    const fonts = new Set(GLYPHSET.files.map((file) => file.font));
    for (const layer of layers) {
      expect(layer.layout['text-field']).toEqual(['coalesce', ['get', 'name'], ['get', 'name:en']]);
      for (const font of layer.layout['text-font'] as string[]) expect(fonts.has(font)).toBe(true);
    }
  });

  it('roads follow the line; cities sort before barangays, roads and streets', () => {
    expect(byId['label-major-road'].layout['symbol-placement']).toBe('line');
    const sort = layers.map((layer) => layer.layout['symbol-sort-key'] as number);
    expect([...sort].sort((a, b) => a - b)).toEqual(sort);
  });

  it('dims to 50 % while a route is selected', () => {
    for (const layer of layers) expect(layer.paint['text-opacity']).toBe(1);
    for (const layer of labelLayers(MAP_LABELS[scheme], true)) expect(layer.paint['text-opacity']).toBe(LABEL_DIMMED_OPACITY);
  });

  it('text and muted text reach 4.5:1 on the halo, and the halo is the land colour', () => {
    const { text, muted, halo } = MAP_LABELS[scheme];
    expect(halo).toBe(BASE_MAPS[scheme].land);
    expect(contrastRatio(text, halo)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(muted, halo)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});

import { fitCamera, latAboveCenter, zoomAbout } from '../geo/fit';

describe('fitCamera (the driver map default view)', () => {
  const r4: [number, number, number, number] = [125.5279, 8.9262, 125.6421, 8.9623];
  const screen = { width: 412, height: 916 };
  const none = { top: 0, right: 0, bottom: 0, left: 0 };

  it('fits the wider side: R4 on a whole 412 dp screen is about zoom 11.3', () => {
    const fit = fitCamera(r4, screen, none);
    expect(fit?.zoom).toBeCloseTo(11.3, 1);
    expect(fit?.center[0]).toBeCloseTo((r4[0] + r4[2]) / 2, 4);
    expect(fit?.center[1]).toBeCloseTo((r4[1] + r4[3]) / 2, 3);
  });

  it('zooms out to fit the strip the panels leave, and moves the centre so the route sits in it', () => {
    const panels = { top: 248, right: 104, bottom: 487, left: 64 };
    const fit = fitCamera(r4, screen, panels);
    expect(fit?.zoom).toBeLessThan(fitCamera(r4, screen, none)?.zoom ?? 0);
    // More is covered at the bottom than at the top, so the camera centre is south of the route
    expect(fit?.center[1]).toBeLessThan((r4[1] + r4[3]) / 2);
    // More is covered on the right, so the centre is east of the route's middle
    expect(fit?.center[0]).toBeGreaterThan((r4[0] + r4[2]) / 2);
  });

  it('gives up when the panels cover the screen', () => {
    expect(fitCamera(r4, screen, { top: 500, right: 0, bottom: 500, left: 0 })).toBeNull();
  });
});

describe('latAboveCenter', () => {
  it('halves with each zoom level', () => {
    const at12 = latAboveCenter(8.95, 12, 916);
    expect(latAboveCenter(8.95, 13, 916)).toBeCloseTo(at12 / 2, 4);
    expect(at12).toBeGreaterThan(0);
  });
});

describe('zoomAbout (zoom buttons keep the visible strip still)', () => {
  it('keeps the centre when the anchor is the middle', () => {
    const [lon, lat] = zoomAbout([125.58, 8.94], 12, 13, { x: 0, y: 0 });
    expect(lon).toBeCloseTo(125.58, 6);
    expect(lat).toBeCloseTo(8.94, 6);
  });

  it('moves the centre toward an anchor above the middle when zooming in, and back when zooming out', () => {
    const start: [number, number] = [125.58, 8.94];
    const zoomedIn = zoomAbout(start, 12, 13, { x: 0, y: -120 });
    expect(zoomedIn[1]).toBeGreaterThan(start[1]);
    const back = zoomAbout(zoomedIn, 13, 12, { x: 0, y: -120 });
    expect(back[0]).toBeCloseTo(start[0], 6);
    expect(back[1]).toBeCloseTo(start[1], 6);
  });
});

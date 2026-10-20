import { TOUR_STEPS, placeBubble } from '../ui/tourPlacement';

const SCREEN = { width: 400, height: 800 };
const BUBBLE = { width: 300, height: 120 };
const GAP = 12;
const MARGIN = 16;
const ARROW = 24;

describe('tips tour placement (ST2-D)', () => {
  it('goes below a control in the top half, pointing at its centre', () => {
    const place = placeBubble({ x: 20, y: 40, width: 48, height: 48 }, SCREEN, BUBBLE, GAP, MARGIN, ARROW);
    expect(place.below).toBe(true);
    expect(place.top).toBe(40 + 48 + GAP);
    expect(place.left).toBe(MARGIN);
    expect(place.left + place.arrowLeft).toBe(44);
  });

  it('goes above a control in the bottom half', () => {
    const place = placeBubble({ x: 330, y: 600, width: 48, height: 48 }, SCREEN, BUBBLE, GAP, MARGIN, ARROW);
    expect(place.below).toBe(false);
    expect(place.top).toBe(600 - GAP - BUBBLE.height);
    expect(place.left).toBe(SCREEN.width - MARGIN - BUBBLE.width);
    expect(place.left + place.arrowLeft).toBe(354);
  });

  it('stays on screen and keeps the arrow off the rounded corners', () => {
    const place = placeBubble({ x: 396, y: 790, width: 4, height: 4 }, SCREEN, BUBBLE, GAP, MARGIN, ARROW);
    expect(place.left).toBeGreaterThanOrEqual(MARGIN);
    expect(place.left + BUBBLE.width).toBeLessThanOrEqual(SCREEN.width - MARGIN);
    expect(place.arrowLeft).toBeLessThanOrEqual(BUBBLE.width - ARROW);
    expect(place.arrowLeft).toBeGreaterThanOrEqual(ARROW);
  });

  it('has nine steps, each once', () => {
    expect(TOUR_STEPS).toHaveLength(10);
    expect(new Set(TOUR_STEPS).size).toBe(TOUR_STEPS.length);
  });
});

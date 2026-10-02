import { RSSI_SMOOTHING_ALPHA } from '../config';
import { smoothRssi } from '../rssi/ema';

describe('RSSI smoothing', () => {
  it('the first reading initializes the average', () => {
    expect(smoothRssi(null, -60)).toBe(-60);
  });

  it('with alpha 0.3, -60 then -70 gives -63.0', () => {
    expect(RSSI_SMOOTHING_ALPHA).toBe(0.3);
    const first = smoothRssi(null, -60);
    expect(smoothRssi(first, -70)).toBeCloseTo(-63.0, 9);
  });

  it('uses the alpha it is given', () => {
    expect(smoothRssi(-60, -70, 0.5)).toBeCloseTo(-65, 9);
  });
});

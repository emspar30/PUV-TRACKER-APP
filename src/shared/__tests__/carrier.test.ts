import { carrierFamily, simLabel } from '../sms/carrier';

describe('carrierFamily (gateway SIM labels, DR7)', () => {
  it.each([
    ['GLOBE', 'Globe/TM'],
    ['Globe Telecom', 'Globe/TM'],
    ['TM', 'Globe/TM'],
    ['Touch Mobile', 'Globe/TM'],
    ['Smart', 'Smart/TNT'],
    ['SMART Prepaid', 'Smart/TNT'],
    ['TNT', 'Smart/TNT'],
    ['Talk N Text', 'Smart/TNT'],
    ['Sun Cellular', 'Smart/TNT'],
    ['DITO', 'DITO'],
  ] as const)('%s is %s', (name, family) => {
    expect(carrierFamily(name)).toBe(family);
  });

  it('knows no other network, and matches whole words only', () => {
    expect(carrierFamily('Vodafone')).toBeNull();
    expect(carrierFamily('ATMOSPHERE')).toBeNull();
    expect(carrierFamily('Sunrise')).toBeNull();
    expect(carrierFamily('')).toBeNull();
    expect(carrierFamily(null)).toBeNull();
  });
});

describe('simLabel', () => {
  it('numbers the slot from 1 and names the family', () => {
    expect(simLabel({ slotIndex: 0, carrierName: 'GLOBE', displayName: 'SIM1' })).toEqual({ slot: 1, network: 'Globe/TM' });
    expect(simLabel({ slotIndex: 1, carrierName: null, displayName: 'TNT' })).toEqual({ slot: 2, network: 'Smart/TNT' });
  });

  it('keeps the SIM’s own name for an unknown network, and null when there is none', () => {
    expect(simLabel({ slotIndex: 0, carrierName: 'Vodafone', displayName: null })).toEqual({ slot: 1, network: 'Vodafone' });
    expect(simLabel({ slotIndex: 0, carrierName: ' ', displayName: null })).toEqual({ slot: 1, network: null });
  });
});

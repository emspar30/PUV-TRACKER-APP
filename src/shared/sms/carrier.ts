// DR7: the gateway's SIM choice in words. Android gives each SIM's slot and the network name the SIM
// reports ("GLOBE", "Smart", "TNT", "TM", "DITO", sometimes with more text); the admin picks the SIM
// by slot and network family. Android cannot tell an app the prepaid balance, and Philippine SIMs
// rarely store their own number, so neither is shown.

export type CarrierFamily = 'Smart/TNT' | 'Globe/TM' | 'DITO';

// Whole words only, so "TM" does not match inside another name
const FAMILIES: readonly (readonly [CarrierFamily, RegExp])[] = [
  ['Smart/TNT', /\b(smart|tnt|talk ?n ?text|sun( cellular)?)\b/i],
  ['Globe/TM', /\b(globe|tm|touch ?mobile)\b/i],
  ['DITO', /\bdito\b/i],
];

export function carrierFamily(name: string | null): CarrierFamily | null {
  if (!name) return null;
  return FAMILIES.find(([, pattern]) => pattern.test(name))?.[0] ?? null;
}

// "SIM 1 · Globe/TM"; the SIM's own name when the family is unknown; null when Android gave no name
export function simLabel(sim: { slotIndex: number; carrierName: string | null; displayName: string | null }): {
  slot: number;
  network: string | null;
} {
  const name = sim.carrierName?.trim() || sim.displayName?.trim() || null;
  return { slot: sim.slotIndex + 1, network: carrierFamily(sim.carrierName) ?? carrierFamily(sim.displayName) ?? name };
}

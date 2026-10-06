// B7: Profile's General History: every action the phone knows of, newest first. The Energy
// entries (check-ins, relays, refills, tracking) and the rides boarded, without the ones before
// the user last tapped Clear History. Clearing only hides them here: the Energy balance and the
// ride counts stay as they are.

export type HistoryEnergy = { kind: string; amount: number; atMs: number };
export type HistoryRide = { routeCode: string; stationCode: string; atMs: number };

export type HistoryItem = ({ type: 'energy' } & HistoryEnergy) | ({ type: 'ride' } & HistoryRide);

export function generalHistory(
  energy: readonly HistoryEnergy[],
  rides: readonly HistoryRide[],
  clearedAtMs: number | null,
): HistoryItem[] {
  const items: HistoryItem[] = [
    ...energy.map((entry) => ({ type: 'energy' as const, ...entry })),
    ...rides.map((ride) => ({ type: 'ride' as const, ...ride })),
  ];
  return items.filter((item) => clearedAtMs === null || item.atMs > clearedAtMs).sort((a, b) => b.atMs - a.atMs);
}

import { useEffect, useState } from 'react';

import { formatRefillIn } from '@/shared/backend/rules';
import { ENERGY_COUNTDOWN_TICK_S } from '@/shared/config';
import { refreshWhenDue, useEnergyStore } from '@/state/energyStore';
import { strings } from '@/strings';

const MS_PER_S = 1000;

// The time left until the next passive refill ("11h 59m"), or null when there is no wallet, it is
// full, or the refill is due now. When it comes due the wallet refreshes, which books the refill.
export function useRefillCountdown(): string | null {
  const nextRefillMs = useEnergyStore((state) => state.snapshot?.nextRefillMs ?? null);
  const [nowMs, setNowMs] = useState(Date.now);

  useEffect(() => {
    if (nextRefillMs === null) return undefined;
    const tick = () => setNowMs(Date.now());
    // Catch up at once when a new wallet arrives, then tick
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, ENERGY_COUNTDOWN_TICK_S * MS_PER_S);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [nextRefillMs]);

  const due = nextRefillMs !== null && nowMs >= nextRefillMs;
  useEffect(() => {
    if (due && nextRefillMs !== null) refreshWhenDue(nextRefillMs);
  }, [due, nextRefillMs]);

  if (nextRefillMs === null || due) return null;
  const { hours, minutes } = formatRefillIn(nextRefillMs - nowMs);
  return strings.profilePage.refillIn(hours, minutes);
}

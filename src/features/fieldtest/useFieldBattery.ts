import { getBatteryLevelAsync } from 'expo-battery';
import { useEffect } from 'react';

import { FIELD_BATTERY_SAMPLE_MIN } from '@/shared/config';
import { fieldLog, useFieldLogStore } from '@/state/fieldLogStore';
import { useRelayStore } from '@/state/relayStore';

const MS_PER_MIN = 60_000;
const PERCENT = 100;

// S10 (E4): while the field test log records and a relay runs, the battery level is noted when the
// relay starts and every FIELD_BATTERY_SAMPLE_MIN, so the log gives % per hour of relaying
export function useFieldBattery(): void {
  const relaying = useRelayStore((store) => store.session !== null);
  const recording = useFieldLogStore((store) => store.recording);

  useEffect(() => {
    if (!relaying || !recording) return undefined;
    const sample = () => {
      void getBatteryLevelAsync()
        .then((level) => {
          if (level >= 0) fieldLog('battery', Math.round(level * PERCENT));
        })
        .catch(() => undefined);
    };
    sample();
    const timer = setInterval(sample, FIELD_BATTERY_SAMPLE_MIN * MS_PER_MIN);
    return () => clearInterval(timer);
  }, [relaying, recording]);
}

import type { Classification } from '@/shared/config';

import { useProfileStore } from './profileStore';

// The one way screens read and change the fare type (the fare classification). The quick chip on
// My Ride and the Settings sheet both use it, so they always show and store the same value: the
// classification kept on this phone by the profile store (PRD 7.1).

export function useFareType(): [Classification, (next: Classification) => void] {
  const classification = useProfileStore((state) => state.classification);
  const setClassification = useProfileStore((state) => state.setClassification);
  return [classification, setClassification];
}

export function getFareType(): Classification {
  return useProfileStore.getState().classification;
}

export function setFareType(next: Classification): void {
  useProfileStore.getState().setClassification(next);
}

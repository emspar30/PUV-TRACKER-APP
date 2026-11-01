import { useCallback, useEffect, useRef, useState } from 'react';

import { CONSOLE_REFRESH_S } from '@/shared/config';
import { photosLeft, type ConsoleRegistration } from '@/shared/driver/registrationConsole';

import type { ConsoleApi } from './api';

const MS_PER_S = 1000;

// The registrations and whether the admin PIN is set, reloaded while the page is in view on any tab,
// so the side navigation's count stays current. Each load also deletes the photos of registrations no
// longer waiting (D1).
export function useRegistrations(api: ConsoleApi) {
  const [rows, setRows] = useState<ConsoleRegistration[] | null>(null);
  const [pinSet, setPinSet] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  // Registrations whose leftover photos are being deleted, so a reload does not start it twice
  const cleaning = useRef(new Set<string>());

  const load = useCallback(async () => {
    const [list, pin] = await Promise.all([api.registrations(), api.pinIsSet()]);
    if (!list.ok) {
      setError(list.error);
      return;
    }
    setError(null);
    setRows(list.value);
    setUpdatedAt(Date.now());
    if (pin.ok) setPinSet(pin.value);
    for (const left of photosLeft(list.value)) {
      if (cleaning.current.has(left.registrationId)) continue;
      cleaning.current.add(left.registrationId);
      void api.deletePhotos(left.registrationId, left.paths).finally(() => cleaning.current.delete(left.registrationId));
    }
  }, [api]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, CONSOLE_REFRESH_S * MS_PER_S);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  return { rows, pinSet, error, updatedAt, load };
}

export type RegistrationsState = ReturnType<typeof useRegistrations>;

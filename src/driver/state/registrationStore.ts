import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isInstallToken } from '@/shared/driver/registration';
import type { RegistrationProgress } from '@/shared/driver/registrationFlow';

// DRG4: what the driver phone remembers while it registers (PRD 9.5), so a restart picks up where it
// was: the number checked, the plate and route, which photos are uploaded, and after submission the
// install token. The token is kept in the app's private storage (owner decision D2): it works once,
// only for collecting this phone's setup after approval. No photo, code or setup secret is kept here.

type RegistrationState = RegistrationProgress & {
  setChecked: (phone: string, check: string, uploads: { id: string; vehicle: string }, atMs: number) => void;
  setVehicle: (plate: string, route: string) => void;
  setUploaded: (which: 'id' | 'vehicle') => void;
  setToken: (token: string) => void;
  resetRegistration: () => void;
};

const EMPTY: RegistrationProgress = {
  phone: null,
  check: null,
  checkedAtMs: null,
  uploads: null,
  uploaded: { id: false, vehicle: false },
  plate: null,
  route: null,
  token: null,
};

const deviceStorage = createJSONStorage<RegistrationProgress>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

const isString = (value: unknown): value is string => typeof value === 'string';
const stringOrNull = (value: unknown): string | null => (isString(value) ? value : null);

// A damaged or old saved value falls back to "nothing done", never to a half registration
export function validProgress(value: unknown): RegistrationProgress {
  if (typeof value !== 'object' || value === null) return EMPTY;
  const saved = value as Record<string, unknown>;
  const uploads = saved.uploads as Record<string, unknown> | null | undefined;
  const uploaded = saved.uploaded as Record<string, unknown> | null | undefined;
  const token = stringOrNull(saved.token);
  return {
    phone: stringOrNull(saved.phone),
    check: stringOrNull(saved.check),
    checkedAtMs: typeof saved.checkedAtMs === 'number' ? saved.checkedAtMs : null,
    uploads: uploads && isString(uploads.id) && isString(uploads.vehicle) ? { id: uploads.id, vehicle: uploads.vehicle } : null,
    uploaded: { id: uploaded?.id === true, vehicle: uploaded?.vehicle === true },
    plate: stringOrNull(saved.plate),
    route: stringOrNull(saved.route),
    token: token && isInstallToken(token) ? token : null,
  };
}

export const useRegistrationStore = create<RegistrationState>()(
  persist(
    (set) => ({
      ...EMPTY,
      // A new number (a new check) starts the photos over, since they are stored under the check; the
      // plate and route typed before stay
      setChecked: (phone, check, uploads, atMs) =>
        set((state) => ({ ...EMPTY, phone, check, uploads, checkedAtMs: atMs, plate: state.plate, route: state.route })),
      setVehicle: (plate, route) => set({ plate, route }),
      setUploaded: (which) => set((state) => ({ uploaded: { ...state.uploaded, [which]: true } })),
      setToken: (token) => set({ token }),
      resetRegistration: () => set(EMPTY),
    }),
    {
      name: 'driver-registration',
      storage: deviceStorage,
      partialize: ({ phone, check, checkedAtMs, uploads, uploaded, plate, route, token }) => ({ phone, check, checkedAtMs, uploads, uploaded, plate, route, token }),
      merge: (persisted, current) => ({ ...current, ...validProgress(persisted) }),
    },
  ),
);

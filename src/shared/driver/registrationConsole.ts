import { REGISTRATION_REASON_MAX_CHARS } from '../config';
import type { RegistrationStatus } from './registration';

// DRG5: the admin console's rules (PRD 9.5), kept out of the page so they are tested in plain Node.
// The rows are what the console_registrations and console_drivers database functions return.

export type ConsoleRegistration = {
  registration_id: string;
  status: RegistrationStatus;
  phone_e164: string;
  plate: string;
  route_id: string;
  vehicle_id: string;
  reason: string | null;
  id_photo_path: string | null;
  vehicle_photo_path: string | null;
  created_at: string;
  decided_at: string | null;
  // The active phone already on the same plate, which an approval replaces
  active_device: string | null;
};

export type ConsoleDriver = {
  device_id: string;
  vehicle_id: string;
  plate: string;
  route_id: string;
  phone_e164: string | null;
  provisioned_at: string;
};

// The review queue, oldest first (first come, first served), and the rest as the database orders
// them (newest first)
export function splitRegistrations(rows: readonly ConsoleRegistration[]): { waiting: ConsoleRegistration[]; decided: ConsoleRegistration[] } {
  const waiting = rows.filter((row) => row.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const decided = rows.filter((row) => row.status !== 'pending');
  return { waiting, decided };
}

// Registrations that are no longer waiting but still have photos in the bucket: a decision whose
// deletion did not finish, or a registration that a newer one from the same number expired. D1 says
// the photos go at the decision, so the console deletes these whenever it loads the list.
export function photosLeft(rows: readonly ConsoleRegistration[]): { registrationId: string; paths: string[] }[] {
  return rows
    .filter((row) => row.status !== 'pending')
    .map((row) => ({
      registrationId: row.registration_id,
      paths: [row.id_photo_path, row.vehicle_photo_path].filter((path): path is string => path !== null),
    }))
    .filter((left) => left.paths.length > 0);
}

// The reason the driver sees, trimmed, or null when it is empty or longer than the database keeps
export function rejectionReason(text: string): string | null {
  const reason = text.trim().replace(/\s+/g, ' ');
  return reason.length > 0 && reason.length <= REGISTRATION_REASON_MAX_CHARS ? reason : null;
}

const PH_E164 = /^\+63(9\d{2})(\d{3})(\d{4})$/;

// +639171234567 as 0917 123 4567, the way the number is written on a phone; anything else as given
export function localPhNumber(e164: string): string {
  const parts = PH_E164.exec(e164);
  return parts ? `0${parts[1]} ${parts[2]} ${parts[3]}` : e164;
}

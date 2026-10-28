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

// The local way of writing a number, shared with the driver app
export { localPhNumber } from './phone';

// --- The Registrations page's tabs: waiting for review, approved (set up or not yet), rejected, and
// everything (an expired registration shows only there)
export const REGISTRATION_TABS = ['pending', 'approved', 'rejected', 'all'] as const;
export type RegistrationTab = (typeof REGISTRATION_TABS)[number];

export function inTab(row: Pick<ConsoleRegistration, 'status'>, tab: RegistrationTab): boolean {
  switch (tab) {
    case 'pending':
      return row.status === 'pending';
    case 'approved':
      return row.status === 'approved' || row.status === 'collected';
    case 'rejected':
      return row.status === 'rejected';
    case 'all':
      return true;
  }
}

export function tabCounts(rows: readonly Pick<ConsoleRegistration, 'status'>[]): Record<RegistrationTab, number> {
  const counts = { pending: 0, approved: 0, rejected: 0, all: 0 };
  for (const row of rows) for (const tab of REGISTRATION_TABS) if (inTab(row, tab)) counts[tab] += 1;
  return counts;
}

// A decided tab's rows, newest decision (or, still waiting, newest submission) first
export function rowsInTab(rows: readonly ConsoleRegistration[], tab: RegistrationTab): ConsoleRegistration[] {
  return rows.filter((row) => inTab(row, tab)).sort((a, b) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at));
}

// --- The Drivers page: by route and by plate, newest set up first

// A plate as compared in a search: no spaces, upper case ("tst 001" finds "TST 001" and "TST001")
const plateKey = (plate: string) => plate.replace(/\s+/g, '').toUpperCase();

// The routes the listed phones are on, in route order (R2 before R14)
export function driverRoutes(rows: readonly Pick<ConsoleDriver, 'route_id'>[]): string[] {
  const number = (route: string) => Number(route.replace(/\D/g, ''));
  return [...new Set(rows.map((row) => row.route_id))].sort((a, b) => number(a) - number(b) || a.localeCompare(b));
}

// The phones on a route (null: every route) whose plate contains the search, newest set up first
export function filterDrivers(rows: readonly ConsoleDriver[], route: string | null, plateSearch: string): ConsoleDriver[] {
  const wanted = plateKey(plateSearch);
  return rows
    .filter((row) => (route === null || row.route_id === route) && plateKey(row.plate).includes(wanted))
    .sort((a, b) => b.provisioned_at.localeCompare(a.provisioned_at));
}

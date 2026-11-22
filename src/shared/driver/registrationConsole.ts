import { REGISTRATION_REASON_MAX_CHARS } from '../config';
import { canApprove, failedChecks, REVIEW_CHECKS, type CheckResult, type DocumentType, type RegistrationStatus, type ReviewCheck, type ReviewChecks } from './registration';

// DRG5: the admin console's rules (PRD 9.5), kept out of the page so they are tested in plain Node.
// The rows are what the console_registrations_ltfrb and console_drivers database functions return.

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
  // 2026-11-19 (owner): the name as written on the LTFRB document, which document, when the selfie
  // was taken, and the admin's checks once decided. Null on registrations sent before then; the name
  // is also cleared at a rejection, an expiry and a retire.
  full_name: string | null;
  document_type: DocumentType | null;
  selfie_taken_at: string | null;
  checks: ReviewChecks | null;
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

// --- The route filter, on both pages

// The routes the listed rows are on, in route order (R2 before R14)
export function listedRoutes(rows: readonly { route_id: string }[]): string[] {
  const number = (route: string) => Number(route.replace(/\D/g, ''));
  return [...new Set(rows.map((row) => row.route_id))].sort((a, b) => number(a) - number(b) || a.localeCompare(b));
}

// The rows on one route (null: every route)
export function onRoute<T extends { route_id: string }>(rows: readonly T[], route: string | null): T[] {
  return route === null ? [...rows] : rows.filter((row) => row.route_id === route);
}

// --- The Drivers page: by route and by plate, newest set up first

// A plate as compared in a search: no spaces, upper case ("tst 001" finds "TST 001" and "TST001")
const plateKey = (plate: string) => plate.replace(/\s+/g, '').toUpperCase();

// The registration a driver phone was set up from, for its details: the newest one set up for the same
// multicab and number. None for a phone set up before registration, or without a recorded number.
export function driverRegistration(driver: ConsoleDriver, rows: readonly ConsoleRegistration[]): ConsoleRegistration | null {
  if (driver.phone_e164 === null) return null;
  const matches = rows.filter(
    (row) => row.status === 'collected' && row.vehicle_id === driver.vehicle_id && row.phone_e164 === driver.phone_e164,
  );
  return matches.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

// The phones on a route (null: every route) whose plate contains the search, newest set up first
export function filterDrivers(rows: readonly ConsoleDriver[], route: string | null, plateSearch: string): ConsoleDriver[] {
  const wanted = plateKey(plateSearch);
  return rows
    .filter((row) => (route === null || row.route_id === route) && plateKey(row.plate).includes(wanted))
    .sort((a, b) => b.provisioned_at.localeCompare(a.provisioned_at));
}

// --- The LTFRB checklist (owner, 2026-11-19; docs/APP_CHANGES_PLAN.md). The admin marks each check by
// eye; console_decide applies the same rule again in the database.

export type DraftChecks = Partial<ReviewChecks>;

// The results a check may take. Face is N/A for the certificate (it carries no photo) and Pass or Fail
// for the old ID; a registration sent before the document type existed may use any of the three. The
// other checks are Pass or Fail.
export function checkChoices(check: ReviewCheck, document: DocumentType | null): readonly CheckResult[] {
  if (check !== 'face') return ['pass', 'fail'];
  if (document === 'academy_certificate') return ['na'];
  if (document === 'academy_id') return ['pass', 'fail'];
  return ['pass', 'fail', 'na'];
}

// The checks as a card opens: Face already N/A for the certificate, nothing else marked
export function startingChecks(document: DocumentType | null): DraftChecks {
  return document === 'academy_certificate' ? { face: 'na' } : {};
}

// All five checks once each is marked with a result it may take, else null
export function completeChecks(draft: DraftChecks, document: DocumentType | null): ReviewChecks | null {
  for (const check of REVIEW_CHECKS) {
    const result = draft[check];
    if (result === undefined || !checkChoices(check, document).includes(result)) return null;
  }
  return draft as ReviewChecks;
}

// Approve: every check marked, Document, Name, On the list and Plate passed, and Face passed for the
// old ID or N/A for the certificate (either, for a registration without a document type)
export function mayApprove(draft: DraftChecks, document: DocumentType | null): boolean {
  const checks = completeChecks(draft, document);
  if (!checks) return false;
  if (document !== null) return canApprove(document, checks);
  return canApprove('academy_id', { ...checks, face: checks.face === 'na' ? 'pass' : checks.face });
}

// Reject: every check marked and at least one failed; the reason is chosen from the failed ones
export function mayReject(draft: DraftChecks, document: DocumentType | null): boolean {
  const checks = completeChecks(draft, document);
  return checks !== null && failedChecks(checks).length > 0;
}

// --- Deciding, then deleting both photos (D1; PRD 9.5). Storage and the database are passed in, so
// the order is tested without either: the photos go right after the decision, and their deletion is
// recorded only once the bucket no longer holds them.

export type ConsoleResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type PhotoBucket = {
  // How many files storage says it deleted
  remove(paths: readonly string[]): Promise<ConsoleResult<number>>;
  // Whether any of the files is still there
  stillStored(paths: readonly string[]): Promise<boolean>;
};

// Storage answers without an error even when it deleted nothing, so a short answer is checked against
// the bucket before the deletion is recorded (console_photos_deleted clears the paths)
export async function deletePhotos(
  paths: readonly string[],
  bucket: PhotoBucket,
  recordDeleted: () => Promise<ConsoleResult<boolean>>,
): Promise<ConsoleResult<boolean>> {
  if (paths.length > 0) {
    const removed = await bucket.remove(paths);
    if (!removed.ok) return removed;
    if (removed.value < paths.length && (await bucket.stillStored(paths))) return { ok: false, error: 'photos_not_deleted' };
  }
  return recordDeleted();
}

export type DecidedPhotos = { id_photo_path: string | null; vehicle_photo_path: string | null };

// The decision (approve or reject), then the deletion of the photo paths it returns. A deletion that
// does not finish leaves the decision standing; the next load of the list finishes it (photosLeft).
export async function decideThenDelete(
  decide: () => Promise<ConsoleResult<DecidedPhotos[]>>,
  removePhotos: (paths: string[]) => Promise<ConsoleResult<boolean>>,
): Promise<ConsoleResult<null>> {
  const decided = await decide();
  if (!decided.ok) return decided;
  const paths = decided.value.flatMap((row) => [row.id_photo_path, row.vehicle_photo_path]).filter((path): path is string => path !== null);
  await removePhotos(paths);
  return { ok: true, value: null };
}

import { REGISTRATION_PHOTO_MAX_BYTES, REGISTRATION_PHOTO_MAX_PX, REGISTRATION_SUBMIT_WITHIN_MIN } from '../config';

// The driver app's registration flow (DRG4; PRD 9.5), as pure rules: where to pick up after the app
// was closed, which camera size keeps a photo small, and what the app may do with each status.

const MS_PER_MIN = 60000;
const SIZE_RE = /^(\d+)x(\d+)$/;

// What the phone remembers between screens and restarts (registrationStore)
export type RegistrationProgress = {
  phone: string | null;
  // The verified number check and when it was verified; photos and submission must follow in time
  check: string | null;
  checkedAtMs: number | null;
  uploads: { id: string; vehicle: string } | null;
  uploaded: { id: boolean; vehicle: boolean };
  plate: string | null;
  route: string | null;
  // Returned once at submission; from then on the phone only waits
  token: string | null;
};

export type RegistrationStep = 'welcome' | 'vehicle' | 'photos' | 'review' | 'waiting';

// After a restart: waiting once submitted; back at the plate while the number check is still fresh
// (the photos follow it); otherwise from the start
export function resumeStep(progress: RegistrationProgress, nowMs: number): RegistrationStep {
  if (progress.token) return 'waiting';
  if (!checkFresh(progress, nowMs)) return 'welcome';
  if (!progress.plate || !progress.route) return 'vehicle';
  if (!progress.uploaded.id || !progress.uploaded.vehicle) return 'photos';
  return 'review';
}

// The server takes the photos and the submission only within REGISTRATION_SUBMIT_WITHIN_MIN of the check
export function checkFresh(progress: Pick<RegistrationProgress, 'check' | 'checkedAtMs' | 'uploads'>, nowMs: number): boolean {
  if (!progress.check || progress.checkedAtMs === null || !progress.uploads) return false;
  return nowMs < progress.checkedAtMs + REGISTRATION_SUBMIT_WITHIN_MIN * MS_PER_MIN;
}

// The camera size ("1920x1080") whose long side is the largest within REGISTRATION_PHOTO_MAX_PX, or
// the smallest offered if none fits; null when the camera offers none (it then picks its own)
export function pickPictureSize(sizes: readonly string[]): string | null {
  const parsed = sizes
    .map((size) => {
      const match = SIZE_RE.exec(size);
      return match ? { size, long: Math.max(Number(match[1]), Number(match[2])) } : null;
    })
    .filter((entry): entry is { size: string; long: number } => entry !== null);
  if (parsed.length === 0) return null;
  const fitting = parsed.filter((entry) => entry.long <= REGISTRATION_PHOTO_MAX_PX);
  if (fitting.length > 0) return fitting.reduce((best, entry) => (entry.long > best.long ? entry : best)).size;
  return parsed.reduce((best, entry) => (entry.long < best.long ? entry : best)).size;
}

// A photo the bucket would refuse (REGISTRATION_PHOTO_MAX_BYTES); an unknown size is let through
export function photoTooBig(bytes: number | null): boolean {
  return bytes !== null && bytes > REGISTRATION_PHOTO_MAX_BYTES;
}

// The statuses the registration function reports, and what the waiting screen does with each
export type WaitingStatus = 'pending' | 'approved' | 'rejected' | 'collected' | 'expired' | 'unknown';

export function waitingStatus(status: string | null): WaitingStatus {
  switch (status) {
    case 'pending':
    case 'approved':
    case 'rejected':
    case 'collected':
    case 'expired':
      return status;
    default:
      return 'unknown';
  }
}

// Only an approved registration is collected; rejected, expired and unknown ones start again
export const mayCollect = (status: WaitingStatus): boolean => status === 'approved';
export const mustRegisterAgain = (status: WaitingStatus): boolean => status === 'rejected' || status === 'expired' || status === 'unknown';

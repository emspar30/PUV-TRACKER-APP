// Plug-in point for device integrity checks (PRD 0.7 point 5, PRD 10.3).
// Prototype v0 performs no check: Play Integrity and mock-location detection come later.
// Callers already receive the shape the real check will return.

export type DeviceIntegrityResult = {
  status: 'not_checked' | 'passed' | 'failed';
  reasons: string[];
};

export async function deviceIntegrity(): Promise<DeviceIntegrityResult> {
  return { status: 'not_checked', reasons: ['integrity_check_not_implemented'] };
}

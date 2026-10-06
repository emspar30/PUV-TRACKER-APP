// G0: location consent (PRD 7.1, 15.1). The user agrees to the privacy notice before the app may
// ask Android for location, and may withdraw at any time. A new notice version asks again.
// Pure: the record is kept by the location store on the phone.

import { LOCATION_CONSENT_VERSION } from '../config';

export type ConsentStatus = 'none' | 'consented' | 'withdrawn';

export type ConsentRecord = {
  status: ConsentStatus;
  // The notice version agreed to, and when
  version: number | null;
  atMs: number | null;
};

export const NO_CONSENT: ConsentRecord = { status: 'none', version: null, atMs: null };

export function giveConsent(atMs: number, version = LOCATION_CONSENT_VERSION): ConsentRecord {
  return { status: 'consented', version, atMs };
}

export function withdrawConsent(atMs: number): ConsentRecord {
  return { status: 'withdrawn', version: null, atMs };
}

// Consent to an older notice counts as none
export function consentStatus(record: ConsentRecord, version = LOCATION_CONSENT_VERSION): ConsentStatus {
  if (record.status === 'consented' && record.version !== version) return 'none';
  return record.status;
}

// The system prompt may be shown only after consent
export function mayRequestPermission(record: ConsentRecord): boolean {
  return consentStatus(record) === 'consented';
}

// The position is used only with both consent and the Android permission
export function mayUseLocation(record: ConsentRecord, permission: string): boolean {
  return mayRequestPermission(record) && permission === 'granted';
}

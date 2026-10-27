import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { isInstallToken, decodeCheckData, parseCheckText } from '../../../supabase/functions/_shared/registrationRules.ts';
import { manilaDay } from '../backend/rules';
import { REGISTRATION_CHECK_RESEND_MIN, REGISTRATION_CHECKS_PER_DAY, REGISTRATION_CHECKS_PER_NUMBER_PER_DAY } from '../config';
import type { InboxEntry } from './inbox';
import { normalizePhNumber } from './phone';

// Driver self-registration (PRD 9.5; docs/IMPLEMENTATION_PLAN_DRIVER_REGISTRATION.md). The rules the
// Edge Functions share are defined beside them (supabase/functions/_shared/registrationRules.ts) and
// re-exported here; this file adds what only the app and the tests need: reading the check from an
// inbox entry, the install token's hash, and the D6 limits as the database enforces them.

export {
  canMove,
  CHECK_TEXT_PREFIX,
  checkText,
  decodeCheckData,
  encodeCheckData,
  isCheckCode,
  isInstallToken,
  isRouteCode,
  normalizePlate,
  parseCheckText,
  setupExpired,
  vehicleIdFor,
  type RegistrationStatus,
} from '../../../supabase/functions/_shared/registrationRules.ts';

const MS_PER_MIN = 60000;

// The code in an inbox message, or null if it is not a number check. Any sender is accepted: the
// phone does not know the gateway's number before its setup, and the server checks the code.
export function readCheckCode(entry: Pick<InboxEntry, 'kind' | 'body'>): string | null {
  if (entry.kind === 'text') return parseCheckText(entry.body);
  try {
    return decodeCheckData(hexToBytes(entry.body));
  } catch {
    return null;
  }
}

export type CheckSent = { phone: string; atMs: number };
export type CheckRefusal = 'invalid_number' | 'too_soon' | 'number_limit' | 'daily_limit';
export type CheckDecision = { ok: true; phone: string } | { ok: false; reason: CheckRefusal; retryAtMs?: number };

// May another check SMS go to this number now (D6)? The database decides
// (registration_check_start); this is the same rule for the app and the tests. `sent` is the checks
// already sent, any number, any day; only today's (Manila) count towards the daily limits.
export function checkAllowed(rawPhone: string, sent: readonly CheckSent[], nowMs: number): CheckDecision {
  const phone = normalizePhNumber(rawPhone);
  if (!phone) return { ok: false, reason: 'invalid_number' };
  const today = manilaDay(nowMs);
  const sentToday = sent.filter((check) => manilaDay(check.atMs) === today);
  if (sentToday.length >= REGISTRATION_CHECKS_PER_DAY) return { ok: false, reason: 'daily_limit' };
  const mine = sent.filter((check) => normalizePhNumber(check.phone) === phone);
  if (mine.filter((check) => manilaDay(check.atMs) === today).length >= REGISTRATION_CHECKS_PER_NUMBER_PER_DAY) {
    return { ok: false, reason: 'number_limit' };
  }
  const last = Math.max(...mine.map((check) => check.atMs), Number.NEGATIVE_INFINITY);
  const retryAtMs = last + REGISTRATION_CHECK_RESEND_MIN * MS_PER_MIN;
  if (nowMs < retryAtMs) return { ok: false, reason: 'too_soon', retryAtMs };
  return { ok: true, phone };
}

// The install token's SHA-256, as the server stores it (the token itself stays on the phone, D2)
export function installTokenHash(token: string): string {
  if (!isInstallToken(token)) throw new RangeError('not an install token');
  return bytesToHex(sha256(utf8ToBytes(token)));
}

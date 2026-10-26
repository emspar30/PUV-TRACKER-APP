import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { manilaDay } from '../backend/rules';
import {
  PLATE_MAX_CHARS,
  PLATE_MIN_CHARS,
  REGISTRATION_CHECK_RESEND_MIN,
  REGISTRATION_CHECKS_PER_DAY,
  REGISTRATION_CHECKS_PER_NUMBER_PER_DAY,
  REGISTRATION_CODE_DIGITS,
  REGISTRATION_SETUP_TTL_DAYS,
} from '../config';
import { HEATMAP_TEXT_PREFIX } from '../sms/protocol';
import type { InboxEntry } from './inbox';
import { normalizePhNumber } from './phone';

// Driver self-registration (PRD 9.5; docs/IMPLEMENTATION_PLAN_DRIVER_REGISTRATION.md, DRG1): the rules
// the driver app, the server functions and the admin console share. The driver types the plate and
// picks the route; the number is checked by one SMS from the gateway that the app reads by itself.
// That message arrives through the same inbox as the heatmap: as a data SMS on the heatmap port with
// its own first byte, or as a text with the heatmap prefix, so the native receiver needs no change.
//   data: 0x56 'V' | 0x01 | the code as ASCII digits
//   text: HM2|V|<code>

const CHECK_MAGIC = 0x56;
const CHECK_VERSION = 0x01;
const CHECK_HEADER_BYTES = 2;
const CHECK_TEXT_PREFIX = `${HEATMAP_TEXT_PREFIX}V|`;
const CODE_RE = new RegExp(`^\\d{${REGISTRATION_CODE_DIGITS}}$`);
const CHECK_TEXT_RE = new RegExp(`^${CHECK_TEXT_PREFIX.replace(/\|/g, '\\|')}(\\d{${REGISTRATION_CODE_DIGITS}})$`);
const ASCII_ZERO = 0x30;
const ASCII_NINE = 0x39;
const ROUTE_RE = /^R[1-9]\d?$/;
const PLATE_CHARS_RE = /^[A-Z0-9 ]+$/;
const LETTER_RE = /[A-Z]/;
const DIGIT_RE = /\d/;
// The install token: 32 random bytes as base64url (43 characters), as the gateway's access token
const INSTALL_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const MS_PER_MIN = 60000;
const MS_PER_DAY = 86400000;

// --- Plate and vehicle

// The plate in its one stored form ("abc-1234" and " ABC  1234 " give "ABC 1234"), or null if it is
// not 3 to 10 letters and digits with at least one of each
export function normalizePlate(raw: string): string | null {
  const plate = raw.toUpperCase().replace(/[\s-]+/g, ' ').trim();
  if (!PLATE_CHARS_RE.test(plate)) return null;
  const chars = plate.replace(/ /g, '');
  if (chars.length < PLATE_MIN_CHARS || chars.length > PLATE_MAX_CHARS) return null;
  if (!LETTER_RE.test(chars) || !DIGIT_RE.test(chars)) return null;
  return plate;
}

export function isRouteCode(route: string): boolean {
  return ROUTE_RE.test(route);
}

// The vehicle id an approval creates ("R4" and "ABC 1234" give "R4-ABC1234"), or null if either is invalid
export function vehicleIdFor(route: string, rawPlate: string): string | null {
  const plate = normalizePlate(rawPlate);
  if (!plate || !isRouteCode(route)) return null;
  return `${route}-${plate.replace(/ /g, '')}`;
}

// --- The number check

export function isCheckCode(code: string): boolean {
  return CODE_RE.test(code);
}

export function encodeCheckData(code: string): Uint8Array {
  if (!isCheckCode(code)) throw new RangeError('not a check code');
  const bytes = new Uint8Array(CHECK_HEADER_BYTES + code.length);
  bytes[0] = CHECK_MAGIC;
  bytes[1] = CHECK_VERSION;
  for (let i = 0; i < code.length; i += 1) bytes[CHECK_HEADER_BYTES + i] = code.charCodeAt(i);
  return bytes;
}

export function decodeCheckData(bytes: Uint8Array): string | null {
  if (bytes.length !== CHECK_HEADER_BYTES + REGISTRATION_CODE_DIGITS) return null;
  if (bytes[0] !== CHECK_MAGIC || bytes[1] !== CHECK_VERSION) return null;
  const digits = bytes.subarray(CHECK_HEADER_BYTES);
  if (digits.some((byte) => byte < ASCII_ZERO || byte > ASCII_NINE)) return null;
  return String.fromCharCode(...digits);
}

export function checkText(code: string): string {
  if (!isCheckCode(code)) throw new RangeError('not a check code');
  return `${CHECK_TEXT_PREFIX}${code}`;
}

export function parseCheckText(text: string): string | null {
  return CHECK_TEXT_RE.exec(text.trim())?.[1] ?? null;
}

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

// May another check SMS go to this number now (D6)? `sent` is the checks already sent, any number,
// any day; only today's (Manila) count towards the daily limits.
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

// --- Install token and status

export function isInstallToken(token: string): boolean {
  return INSTALL_TOKEN_RE.test(token);
}

// What the registration stores: the token itself stays on the phone (D2)
export function installTokenHash(token: string): string {
  if (!isInstallToken(token)) throw new RangeError('not an install token');
  return bytesToHex(sha256(utf8ToBytes(token)));
}

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'collected' | 'expired';

const MOVES: Record<RegistrationStatus, readonly RegistrationStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: ['collected', 'expired'],
  rejected: [],
  collected: [],
  expired: [],
};

export function canMove(from: RegistrationStatus, to: RegistrationStatus): boolean {
  return MOVES[from].includes(to);
}

// An approved setup not collected within REGISTRATION_SETUP_TTL_DAYS is expired
export function setupExpired(approvedAtMs: number, nowMs: number): boolean {
  return nowMs >= approvedAtMs + REGISTRATION_SETUP_TTL_DAYS * MS_PER_DAY;
}

// Driver self-registration (PRD 9.5; docs/IMPLEMENTATION_PLAN_DRIVER_REGISTRATION.md): the rules the
// Edge Functions (DRG3) and the driver app share. Pure TypeScript importing only its own folder, so the
// Edge Functions (Deno) can load it; src/shared/driver/registration.ts re-exports it for the app.
//
// The number check arrives through the same inbox as the heatmap, so the driver app's native receiver
// needs no change: as a data SMS on the heatmap port with its own first byte, or as a text under the
// heatmap prefix (HM2|, src/shared/sms/protocol.ts; a test keeps the two equal).
//   data: 0x56 'V' | 0x01 | the code as ASCII digits
//   text: HM2|V|<code>

import { PLATE_MAX_CHARS, PLATE_MIN_CHARS, REGISTRATION_CODE_DIGITS, REGISTRATION_SETUP_TTL_DAYS } from './serverConfig.ts';

const CHECK_MAGIC = 0x56;
const CHECK_VERSION = 0x01;
const CHECK_HEADER_BYTES = 2;
export const CHECK_TEXT_PREFIX = 'HM2|V|';
const CODE_RE = new RegExp(`^\\d{${REGISTRATION_CODE_DIGITS}}$`);
const CHECK_TEXT_RE = new RegExp(`^HM2\\|V\\|(\\d{${REGISTRATION_CODE_DIGITS}})$`);
const ASCII_ZERO = 0x30;
const ASCII_NINE = 0x39;
const ROUTE_RE = /^R[1-9]\d?$/;
const PLATE_CHARS_RE = /^[A-Z0-9 ]+$/;
const LETTER_RE = /[A-Z]/;
const DIGIT_RE = /\d/;
// The install token: 32 random bytes as base64url (43 characters), as the gateway's access token
const INSTALL_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
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

// --- Install token and status

export function isInstallToken(token: string): boolean {
  return INSTALL_TOKEN_RE.test(token);
}

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'collected' | 'expired';

// A newer registration from the same number expires an older one that is still pending or approved
const MOVES: Record<RegistrationStatus, readonly RegistrationStatus[]> = {
  pending: ['approved', 'rejected', 'expired'],
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

// Philippine mobile numbers in E.164 (+639XXXXXXXXX), the one form the gateway allowlist, the
// provisioning QR and the database use. An SMS sender can arrive as 0917..., 63917... or +63917...
// (PRD 9.3: the driver app accepts messages only from the gateway number).

const LOCAL_RE = /^09\d{9}$/;
const INTERNATIONAL_RE = /^639\d{9}$/;
const E164_RE = /^\+639\d{9}$/;

// The number in E.164, or null if it is not a Philippine mobile number
export function normalizePhNumber(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, '');
  if (E164_RE.test(digits)) return digits;
  if (INTERNATIONAL_RE.test(digits)) return `+${digits}`;
  if (LOCAL_RE.test(digits)) return `+63${digits.slice(1)}`;
  return null;
}

export function isSameNumber(a: string, b: string): boolean {
  const left = normalizePhNumber(a);
  return left !== null && left === normalizePhNumber(b);
}

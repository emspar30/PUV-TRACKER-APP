import { DATA_SMS_MAX_BYTES } from '../config';
import { parseHeatmap } from './protocol';

// The data-SMS form of a heatmap message (PRD 9.3: "the same fields in a compact binary form";
// docs/IMPLEMENTATION_PLAN_DRIVER.md section 6.2.4). It is only a transport encoding: the driver app
// turns it back into the canonical text and validates that with validateHeatmap, so the signature
// always covers the text and there is one signing rule.
//   0x48 'H' | 0x02 | route number | seq (2) | minute of day (2) | n | n x [code length, code, count (2)] | mac (4)

const MAGIC = 0x48;
const FORMAT_VERSION = 0x02;
const HEADER_BYTES = 8;
const MAC_BYTES = 4;
const COUNT_BYTES = 2;
const MAX_STOPS = 0xff;
const ROUTE_MAX = 99;
const SEQ_DIGITS = 4;
const HOUR_DIGITS = 2;
const MINUTES_PER_HOUR = 60;
const HEX_RADIX = 16;
const HEX_PER_BYTE = 2;
const CANONICAL_ROUTE_RE = /^R([1-9]\d?)$/;
const CODE_RE = /^[A-Z]{2,4}$/;

const AT_MAGIC = 0;
const AT_VERSION = 1;
const AT_ROUTE = 2;
const AT_SEQ = 3;
const AT_MINUTE = 5;
const AT_COUNT = 7;

const pad = (value: number, digits: number) => String(value).padStart(digits, '0');

// Bytes a message with these stop codes takes (counts do not change the size)
export function heatmapBinarySize(codes: readonly string[]): number {
  return HEADER_BYTES + codes.reduce((sum, code) => sum + 1 + code.length + COUNT_BYTES, 0) + MAC_BYTES;
}

// Throws on a text that is not a well-formed heatmap message with a canonical route (R1 to R99)
export function encodeHeatmapBinary(text: string): Uint8Array {
  const message = parseHeatmap(text);
  if (!message) throw new RangeError('not a heatmap message');
  const route = CANONICAL_ROUTE_RE.exec(message.route);
  if (!route) throw new RangeError(`route must be R1 to R${ROUTE_MAX}: ${message.route}`);
  if (message.nodes.length > MAX_STOPS) throw new RangeError('too many stops');

  const bytes = new Uint8Array(heatmapBinarySize(message.nodes.map((node) => node.code)));
  const view = new DataView(bytes.buffer);
  bytes[AT_MAGIC] = MAGIC;
  bytes[AT_VERSION] = FORMAT_VERSION;
  bytes[AT_ROUTE] = Number(route[1]);
  view.setUint16(AT_SEQ, message.seq);
  view.setUint16(AT_MINUTE, message.minuteOfDay);
  bytes[AT_COUNT] = message.nodes.length;

  let at = HEADER_BYTES;
  for (const { code, count } of message.nodes) {
    bytes[at] = code.length;
    for (let i = 0; i < code.length; i++) bytes[at + 1 + i] = code.charCodeAt(i);
    at += 1 + code.length;
    view.setUint16(at, count);
    at += COUNT_BYTES;
  }
  for (let i = 0; i < MAC_BYTES; i++) {
    bytes[at + i] = parseInt(message.mac.slice(i * HEX_PER_BYTE, (i + 1) * HEX_PER_BYTE), HEX_RADIX);
  }
  return bytes;
}

// The canonical text, or null for bytes that are not a heatmap message in this format
export function decodeHeatmapBinary(bytes: Uint8Array): string | null {
  if (bytes.length < HEADER_BYTES + MAC_BYTES || bytes[AT_MAGIC] !== MAGIC || bytes[AT_VERSION] !== FORMAT_VERSION) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const route = bytes[AT_ROUTE];
  if (route < 1 || route > ROUTE_MAX) return null;
  const seq = view.getUint16(AT_SEQ);
  const minute = view.getUint16(AT_MINUTE);
  const stops = bytes[AT_COUNT];

  const entries: string[] = [];
  let at = HEADER_BYTES;
  for (let n = 0; n < stops; n++) {
    if (at >= bytes.length) return null;
    const length = bytes[at];
    if (at + 1 + length + COUNT_BYTES > bytes.length - MAC_BYTES) return null;
    const code = String.fromCharCode(...bytes.slice(at + 1, at + 1 + length));
    if (!CODE_RE.test(code)) return null;
    at += 1 + length;
    entries.push(`${code}:${view.getUint16(at)}`);
    at += COUNT_BYTES;
  }
  if (at + MAC_BYTES !== bytes.length) return null;

  const mac = Array.from(bytes.slice(at), (byte) => byte.toString(HEX_RADIX).padStart(HEX_PER_BYTE, '0')).join('').toUpperCase();
  const hhmm = pad(Math.floor(minute / MINUTES_PER_HOUR), HOUR_DIGITS) + pad(minute % MINUTES_PER_HOUR, HOUR_DIGITS);
  const text = `HM2|R${route}|${pad(seq, SEQ_DIGITS)}|${hhmm}|${entries.join(',')}|${mac}`;
  // Anything out of range (a seq over 9999, a count over 999, a minute past midnight) fails here
  return parseHeatmap(text) ? text : null;
}

export function fitsDataSms(bytes: Uint8Array): boolean {
  return bytes.length <= DATA_SMS_MAX_BYTES;
}

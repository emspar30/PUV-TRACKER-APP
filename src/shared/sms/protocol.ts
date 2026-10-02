import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { MANILA_UTC_OFFSET_MIN, SMS_MAX_AGE_MIN, SMS_SEQ_MODULUS, SMS_SEQ_NEWER_WINDOW } from '../config';

// SMS payload protocol v2 (PRD 12.3):
//   HM2|<route>|<seq>|<HHMM>|<code>:<count>,<code>:<count>,...|<mac>
// mac = first 4 bytes (8 hex characters) of HMAC-SHA256(key, everything before the last pipe).

const MESSAGE_RE =
  /^HM2\|(R\d{1,2})\|(\d{4})\|(\d{4})\|([A-Z]{2,4}:\d{1,3}(?:,[A-Z]{2,4}:\d{1,3})*)\|([0-9A-F]{8})$/;
const ROUTE_RE = /^R\d{1,2}$/;
const CODE_RE = /^[A-Z]{2,4}$/;

const PREFIX = 'HM2';
const SEQ_DIGITS = 4;
const MAC_BYTES = 4;
const MAX_COUNT = 999;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const HOUR_DIGITS = 2;
const MS_PER_MINUTE = 60000;
const HALF = 0.5;

export type HeatmapNode = {
  code: string;
  count: number;
};

export type HeatmapMessage = {
  route: string;
  seq: number;
  // Minutes after midnight, Asia/Manila
  minuteOfDay: number;
  nodes: HeatmapNode[];
};

export type ParsedHeatmap = HeatmapMessage & {
  hhmm: string;
  mac: string;
  // Everything before the last pipe: the text the signature covers
  signedPart: string;
};

export type RejectReason = 'malformed' | 'wrong_sender' | 'bad_signature' | 'stale_time' | 'old_sequence';

export type ValidationContext = {
  key: string;
  // Sequence number of the last accepted message, or null if none yet
  lastSeq: number | null;
  // Current time as minutes after midnight, Asia/Manila
  nowMinuteOfDay: number;
  // Checked only when both are given
  sender?: string;
  expectedSender?: string;
};

export type ValidationResult = { ok: true; message: ParsedHeatmap } | { ok: false; reason: RejectReason };

function computeMac(signedPart: string, key: string): string {
  const digest = hmac(sha256, utf8ToBytes(key), utf8ToBytes(signedPart));
  return bytesToHex(digest.slice(0, MAC_BYTES)).toUpperCase();
}

function formatHhmm(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
  const minutes = minuteOfDay % MINUTES_PER_HOUR;
  return `${String(hours).padStart(HOUR_DIGITS, '0')}${String(minutes).padStart(HOUR_DIGITS, '0')}`;
}

// Build and sign a heatmap message. Throws on input the format cannot carry.
export function signHeatmap(message: HeatmapMessage, key: string): string {
  const { route, seq, minuteOfDay, nodes } = message;
  if (!ROUTE_RE.test(route)) throw new RangeError(`invalid route: ${route}`);
  if (!Number.isInteger(seq) || seq < 0 || seq >= SMS_SEQ_MODULUS) throw new RangeError(`invalid seq: ${seq}`);
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= MINUTES_PER_DAY) {
    throw new RangeError(`invalid minuteOfDay: ${minuteOfDay}`);
  }
  if (nodes.length === 0) throw new RangeError('at least one station is required');
  for (const { code, count } of nodes) {
    if (!CODE_RE.test(code)) throw new RangeError(`invalid station code: ${code}`);
    if (!Number.isInteger(count) || count < 0 || count > MAX_COUNT) throw new RangeError(`invalid count: ${count}`);
  }

  const list = nodes.map(({ code, count }) => `${code}:${count}`).join(',');
  const signedPart = [PREFIX, route, String(seq).padStart(SEQ_DIGITS, '0'), formatHhmm(minuteOfDay), list].join('|');
  return `${signedPart}|${computeMac(signedPart, key)}`;
}

// Validate the whole message with one regex, then split the station list.
// (A repeated capture group would keep only the last station.)
export function parseHeatmap(sms: string): ParsedHeatmap | null {
  const text = sms.trim();
  const match = MESSAGE_RE.exec(text);
  if (!match) return null;
  const [, route, seq, hhmm, list, mac] = match;

  const hours = Number(hhmm.slice(0, HOUR_DIGITS));
  const minutes = Number(hhmm.slice(HOUR_DIGITS));
  if (hours * MINUTES_PER_HOUR >= MINUTES_PER_DAY || minutes >= MINUTES_PER_HOUR) return null;

  const nodes = list.split(',').map((entry) => {
    const [code, count] = entry.split(':');
    return { code, count: Number(count) };
  });

  return {
    route,
    seq: Number(seq),
    hhmm,
    minuteOfDay: hours * MINUTES_PER_HOUR + minutes,
    nodes,
    mac,
    signedPart: text.slice(0, text.lastIndexOf('|')),
  };
}

// True if seq is 1 to SMS_SEQ_NEWER_WINDOW ahead of lastSeq, modulo SMS_SEQ_MODULUS
export function isNewerSeq(seq: number, lastSeq: number | null): boolean {
  if (lastSeq === null) return true;
  const ahead = (seq - lastSeq + SMS_SEQ_MODULUS) % SMS_SEQ_MODULUS;
  return ahead >= 1 && ahead <= SMS_SEQ_NEWER_WINDOW;
}

// Shortest distance between two times of day, so a window that crosses midnight is handled.
// The message carries no date, so the nearest matching minute is assumed.
export function minutesApart(a: number, b: number): number {
  const diff = Math.abs(a - b) % MINUTES_PER_DAY;
  return diff > MINUTES_PER_DAY * HALF ? MINUTES_PER_DAY - diff : diff;
}

export function manilaMinuteOfDay(date: Date): number {
  const utcMinutes = Math.floor(date.getTime() / MS_PER_MINUTE);
  return (((utcMinutes + MANILA_UTC_OFFSET_MIN) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

// Driver-side acceptance rule: sender, signature, time window, then sequence.
export function validateHeatmap(sms: string, context: ValidationContext): ValidationResult {
  const { key, lastSeq, nowMinuteOfDay, sender, expectedSender } = context;

  if (sender !== undefined && expectedSender !== undefined && sender !== expectedSender) {
    return { ok: false, reason: 'wrong_sender' };
  }

  const message = parseHeatmap(sms);
  if (!message) return { ok: false, reason: 'malformed' };

  if (computeMac(message.signedPart, key) !== message.mac) return { ok: false, reason: 'bad_signature' };
  if (minutesApart(message.minuteOfDay, nowMinuteOfDay) > SMS_MAX_AGE_MIN) return { ok: false, reason: 'stale_time' };
  if (!isNewerSeq(message.seq, lastSeq)) return { ok: false, reason: 'old_sequence' };

  return { ok: true, message };
}

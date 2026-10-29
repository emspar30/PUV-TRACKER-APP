import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { MANILA_UTC_OFFSET_MIN, SMS_MAX_AGE_MIN, SMS_SEQ_MODULUS, SMS_SEQ_NEWER_WINDOW } from '../config';

// SMS payload protocol v2 (PRD 12.3):
//   HM2|<route>|<seq>|<HHMM>|<code>:<count>,<code>:<count>,...|<mac>
// The listed stops update; the others keep their value.
// v3 (CA2-1, Emjay's D7, 2026-10-29): only the stops with someone waiting, so a route with fill stops
// still fits one SMS:
//   HM3|<route>|<seq>|<HHMM>|<F or P>|<code>:<count>,...  or  -|<mac>
// F (full): every stop not listed is 0. P (part): the next message of the same update; listed stops
// update as in v2. "-" is an empty list: nobody waiting anywhere on the route.
// v4 (CA3, Emjay, 2026-10-30): as v3, and a stop may carry how many checked in near it, apart from
// those at it: <code>:<count>+<near> ("SMB:3+1": 3 at SM Butuan, 1 near it). Only sent when someone
// is near, so a driver app that reads v3 only still gets every other update.
//   HM4|<route>|<seq>|<HHMM>|<F or P>|<code>:<count>[+<near>],...  or  -|<mac>
// mac = first 4 bytes (8 hex characters) of HMAC-SHA256(key, everything before the last pipe).

const MESSAGE_RE =
  /^HM2\|(R\d{1,2})\|(\d{4})\|(\d{4})\|([A-Z]{2,4}:\d{1,3}(?:,[A-Z]{2,4}:\d{1,3})*)\|([0-9A-F]{8})$/;
const MESSAGE_V3_RE =
  /^HM3\|(R\d{1,2})\|(\d{4})\|(\d{4})\|([FP])\|(-|[A-Z]{2,4}:\d{1,3}(?:,[A-Z]{2,4}:\d{1,3})*)\|([0-9A-F]{8})$/;
const MESSAGE_V4_RE =
  /^HM4\|(R\d{1,2})\|(\d{4})\|(\d{4})\|([FP])\|(-|[A-Z]{2,4}:\d{1,3}(?:\+\d{1,3})?(?:,[A-Z]{2,4}:\d{1,3}(?:\+\d{1,3})?)*)\|([0-9A-F]{8})$/;
const EMPTY_LIST = '-';
const ROUTE_RE = /^R\d{1,2}$/;
const CODE_RE = /^[A-Z]{2,4}$/;

const PREFIX = 'HM2';
const PREFIX_V3 = 'HM3';
const PREFIX_V4 = 'HM4';
// DR5: the driver phone's SMS receiver keeps a text only if it starts with this (v2, v3, v4 alike);
// anything else that starts so is still refused as malformed here
export const HEATMAP_TEXT_PREFIX = 'HM';
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
  // At the stop (v4: not counting those near it)
  count: number;
  // v4 (CA3): checked in near the stop, between it and the next; absent or 0 for nobody
  near?: number;
};

export type HeatmapMessage = {
  route: string;
  seq: number;
  // Minutes after midnight, Asia/Manila
  minuteOfDay: number;
  nodes: HeatmapNode[];
  // v3 only: true when every stop not listed is 0 (F), false for the next part of an update (P).
  // Absent: a v2 message, where the stops not listed keep their value.
  full?: boolean;
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
  const v3 = message.full !== undefined;
  // v3 may list nothing (nobody waiting anywhere); v2 lists at least one stop
  if (nodes.length === 0 && !v3) throw new RangeError('at least one station is required');
  for (const { code, count, near = 0 } of nodes) {
    if (!CODE_RE.test(code)) throw new RangeError(`invalid station code: ${code}`);
    if (!Number.isInteger(count) || count < 0 || count > MAX_COUNT) throw new RangeError(`invalid count: ${count}`);
    if (!Number.isInteger(near) || near < 0 || near > MAX_COUNT) throw new RangeError(`invalid near count: ${near}`);
  }
  // Someone near a stop needs v4, which only an update (v3's F or P) can be
  const v4 = hasNear(nodes);
  if (v4 && !v3) throw new RangeError('near counts need an update message (full set)');

  const list = nodes.map(entryText).join(',');
  const head = [v4 ? PREFIX_V4 : v3 ? PREFIX_V3 : PREFIX, route, String(seq).padStart(SEQ_DIGITS, '0'), formatHhmm(minuteOfDay)];
  const signedPart = (v3 ? [...head, message.full ? 'F' : 'P', list || EMPTY_LIST] : [...head, list]).join('|');
  return `${signedPart}|${computeMac(signedPart, key)}`;
}

// True when any stop has someone near it (a v4 message)
export function hasNear(nodes: readonly HeatmapNode[]): boolean {
  return nodes.some((node) => (node.near ?? 0) > 0);
}

// "SMB:3", or "SMB:3+1" with someone near
export function entryText({ code, count, near = 0 }: HeatmapNode): string {
  return near > 0 ? `${code}:${count}+${near}` : `${code}:${count}`;
}

// Validate the whole message with one regex, then split the station list.
// (A repeated capture group would keep only the last station.)
export function parseHeatmap(sms: string): ParsedHeatmap | null {
  const text = sms.trim();
  const v2 = MESSAGE_RE.exec(text);
  const update = v2 ? null : (MESSAGE_V3_RE.exec(text) ?? MESSAGE_V4_RE.exec(text));
  let parts: string[];
  let full: { full?: boolean } = {};
  if (v2) parts = v2.slice(1);
  else if (update) {
    const [, r, q, t, mode, l, m] = update;
    parts = [r, q, t, l, m];
    full = { full: mode === 'F' };
  } else return null;
  const [route, seq, hhmm, list, mac] = parts;

  const hours = Number(hhmm.slice(0, HOUR_DIGITS));
  const minutes = Number(hhmm.slice(HOUR_DIGITS));
  if (hours * MINUTES_PER_HOUR >= MINUTES_PER_DAY || minutes >= MINUTES_PER_HOUR) return null;

  const nodes = (list === EMPTY_LIST ? [] : list.split(',')).map((entry) => {
    const [code, counts] = entry.split(':');
    const [count, near] = counts.split('+');
    return near === undefined ? { code, count: Number(count) } : { code, count: Number(count), near: Number(near) };
  });
  // A v4 message lists someone near; one that does not is not v4 (each text has one form)
  if (text.startsWith(PREFIX_V4) !== hasNear(nodes)) return null;

  return {
    route,
    seq: Number(seq),
    hhmm,
    minuteOfDay: hours * MINUTES_PER_HOUR + minutes,
    nodes,
    ...full,
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

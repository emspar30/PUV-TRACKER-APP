import { bytesToHex } from '@noble/hashes/utils.js';

import { encodeHeatmapBinary } from './binary';
import { gsm7Septets } from './gsm';
import { manilaMinuteOfDay, signHeatmap, type HeatmapNode } from './protocol';

// DR5: a signed heatmap message in both forms, for the gateway's carrier test (DR5-M5) and
// scripts/sms-sign.ts (emulator tests, DR5-M1 to M4). The same signing as the SMS worker (DR6).

export type TestHeatmap = {
  text: string;
  // The data SMS form, as hex
  dataHex: string;
  bytes: number;
  septets: number;
};

const CODE_LETTERS = 26;
const LETTER_A = 65;

export function buildTestHeatmap(route: string, seq: number, nodes: readonly HeatmapNode[], atMs: number, key: string): TestHeatmap {
  const text = signHeatmap({ route, seq, minuteOfDay: manilaMinuteOfDay(new Date(atMs)), nodes: [...nodes] }, key);
  const binary = encodeHeatmapBinary(text);
  return { text, dataHex: bytesToHex(binary), bytes: binary.length, septets: gsm7Septets(text) ?? 0 };
}

// "SMB:3,ZAM:0" as nodes; null if any entry is not CODE:count
export function parseNodeList(list: string): HeatmapNode[] | null {
  const nodes: HeatmapNode[] = [];
  for (const entry of list.split(',')) {
    const match = /^([A-Z]{2,4}):(\d{1,3})$/.exec(entry.trim());
    if (!match) return null;
    nodes.push({ code: match[1], count: Number(match[2]) });
  }
  return nodes.length > 0 ? nodes : null;
}

// Made-up three-letter codes (QAA, QAB, ...) to make a test message bigger, for finding the largest
// data SMS the carrier delivers. Q is not the first letter of any real stop code.
export function paddingCodes(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Q${String.fromCharCode(LETTER_A + Math.floor(i / CODE_LETTERS) % CODE_LETTERS)}${String.fromCharCode(LETTER_A + (i % CODE_LETTERS))}`);
}

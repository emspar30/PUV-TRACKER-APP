import { hexToBytes } from '@noble/hashes/utils.js';

import { decodeHeatmapBinary } from '../sms/binary';
import { manilaMinuteOfDay, validateHeatmap, type RejectReason } from '../sms/protocol';
import { driftSample } from './drift';
import { applyMessage, type HeatmapState } from './heatmap';
import { normalizePhNumber } from './phone';

// What the driver phone does with each message from its SMS inbox (PRD 9.3; DR5). The native
// receiver stores only data SMS on the heatmap port and texts that start with the heatmap prefix;
// everything else is decided here:
//   1. the sender must be one of the phone's gateway numbers (wrong_sender);
//   2. a data SMS is turned back into the canonical text (malformed if it is not one);
//   3. validateHeatmap: signature, time window, sequence number;
//   4. the message must be for this phone's route (wrong_route), then it is applied.
// The time checks use when the phone received the message, not when the app read it, so a message
// that waited in the inbox while the app was closed is judged as it arrived. Every message with a
// carrier timestamp gives a clock sample, accepted or not: a wrong clock is exactly when messages
// fail (stale_time).

export type InboxEntry = {
  kind: 'data' | 'text';
  sender: string;
  // The text, or the data message's bytes as hex
  body: string;
  smscMs: number;
  receivedMs: number;
};

export type InboxRejectReason = RejectReason | 'wrong_route';

export type InboxOutcome = { ok: true; seq: number } | { ok: false; reason: InboxRejectReason };

export type InboxContext = {
  // The SMS key from the phone's setup (64 hex characters)
  key: string;
  gatewayNumbers: readonly string[];
};

export type ProcessedEntry = {
  state: HeatmapState;
  outcome: InboxOutcome;
  // Seconds the phone's clock is ahead of the carrier's, or null when the message had no carrier time
  driftS: number | null;
};

export type ProcessedInbox = {
  state: HeatmapState;
  results: (Omit<ProcessedEntry, 'state'> & { entry: InboxEntry })[];
};

function textOf(entry: InboxEntry): string | null {
  if (entry.kind === 'text') return entry.body;
  try {
    return decodeHeatmapBinary(hexToBytes(entry.body));
  } catch {
    return null;
  }
}

export function processEntry(state: HeatmapState, entry: InboxEntry, context: InboxContext): ProcessedEntry {
  const driftS = entry.smscMs > 0 ? driftSample(entry.receivedMs, entry.smscMs) : null;
  const reject = (reason: InboxRejectReason): ProcessedEntry => ({ state, outcome: { ok: false, reason }, driftS });

  const sender = normalizePhNumber(entry.sender);
  const allowed = context.gatewayNumbers.map(normalizePhNumber);
  if (sender === null || !allowed.includes(sender)) return reject('wrong_sender');

  const text = textOf(entry);
  if (text === null) return reject('malformed');

  const result = validateHeatmap(text, {
    key: context.key,
    lastSeq: state.lastSeq,
    nowMinuteOfDay: manilaMinuteOfDay(new Date(entry.receivedMs)),
  });
  if (!result.ok) return reject(result.reason);
  if (result.message.route !== state.route) return reject('wrong_route');

  return { state: applyMessage(state, result.message, entry.receivedMs), outcome: { ok: true, seq: result.message.seq }, driftS };
}

// Entries in the order they arrived (a split route's two messages apply one after the other)
export function processInbox(state: HeatmapState, entries: readonly InboxEntry[], context: InboxContext): ProcessedInbox {
  const ordered = [...entries].sort((a, b) => a.receivedMs - b.receivedMs);
  const results: ProcessedInbox['results'] = [];
  let current = state;
  for (const entry of ordered) {
    const { state: next, outcome, driftS } = processEntry(current, entry, context);
    current = next;
    results.push({ entry, outcome, driftS });
  }
  return { state: current, results };
}

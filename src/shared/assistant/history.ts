// CA1.1: the conversation kept on the phone, so closing Ask Tunton or going to My Rides and back keeps
// it. Only the questions are kept (with the intent each one stands for); the answers are worked out
// again from the data on the phone when shown. The newest ASSISTANT_HISTORY_MAX questions, none older
// than ASSISTANT_HISTORY_MAX_AGE_MIN minutes. Pure: no React Native or Expo imports.

import { ASSISTANT_HISTORY_MAX, ASSISTANT_HISTORY_MAX_AGE_MIN } from '../config';

import type { Intent } from './intent';

export type HistoryEntry = { id: number; question: string; intent: Intent; atMs: number };

const MS_PER_MIN = 60_000;

export function keptHistory(entries: readonly HistoryEntry[], nowMs: number): HistoryEntry[] {
  const oldest = nowMs - ASSISTANT_HISTORY_MAX_AGE_MIN * MS_PER_MIN;
  return entries.filter((entry) => entry.atMs >= oldest).slice(-ASSISTANT_HISTORY_MAX);
}

export function withQuestion(entries: readonly HistoryEntry[], question: string, intent: Intent, nowMs: number): HistoryEntry[] {
  const id = entries.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;
  return keptHistory([...entries, { id, question, intent, atMs: nowMs }], nowMs);
}

// A saved entry read back; anything that is not one (an older or broken save) is dropped
export function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<HistoryEntry>;
  return (
    typeof entry.id === 'number' &&
    typeof entry.question === 'string' &&
    typeof entry.atMs === 'number' &&
    typeof entry.intent === 'object' &&
    entry.intent !== null &&
    typeof (entry.intent as { kind?: unknown }).kind === 'string'
  );
}

// CA1.1: Ask Tunton works only while online. probe: the server answered (true), did not (false),
// there is no backend in this build (null), or not checked yet (undefined). A development build
// without a backend stays usable.
export type AssistantAccess = 'open' | 'offline' | 'checking';

export function accessOf(probe: boolean | null | undefined, dev: boolean): AssistantAccess {
  if (probe === undefined) return 'checking';
  if (probe === null) return dev ? 'open' : 'offline';
  return probe ? 'open' : 'offline';
}

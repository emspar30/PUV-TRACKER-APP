// CA1.1: Ask Tunton's conversation kept on the phone (newest ASSISTANT_HISTORY_MAX questions, none
// older than ASSISTANT_HISTORY_MAX_AGE_MIN), and its online-only rule.

import { accessOf, isHistoryEntry, keptHistory, withQuestion, type HistoryEntry } from '../assistant/history';
import { parseQuery } from '../assistant/intent';
import { ASSISTANT_HISTORY_MAX, ASSISTANT_HISTORY_MAX_AGE_MIN } from '../config';

const NOW = 1_790_000_000_000;
const MINUTE = 60_000;
const entry = (id: number, atMs: number): HistoryEntry => ({ id, question: `q${id}`, intent: { kind: 'help' }, atMs });

describe('the conversation kept on the phone', () => {
  it('adds a question with the next id and its intent', () => {
    const one = withQuestion([], 'Is R4 running?', parseQuery('Is R4 running?'), NOW);
    const two = withQuestion(one, 'to SM', parseQuery('to SM'), NOW + 1);
    expect(two.map((item) => item.id)).toEqual([1, 2]);
    expect(two[0]).toMatchObject({ question: 'Is R4 running?', intent: { kind: 'status', routeCode: 'R4' }, atMs: NOW });
  });

  it(`keeps the newest ${ASSISTANT_HISTORY_MAX} questions`, () => {
    let entries: HistoryEntry[] = [];
    for (let i = 0; i < ASSISTANT_HISTORY_MAX + 5; i += 1) entries = withQuestion(entries, `q${i}`, { kind: 'help' }, NOW + i);
    expect(entries).toHaveLength(ASSISTANT_HISTORY_MAX);
    expect(entries[0].question).toBe('q5');
    expect(entries.at(-1)?.question).toBe(`q${ASSISTANT_HISTORY_MAX + 4}`);
  });

  it(`lets go of questions older than ${ASSISTANT_HISTORY_MAX_AGE_MIN} minutes (an hour)`, () => {
    expect(ASSISTANT_HISTORY_MAX_AGE_MIN).toBe(60);
    const limit = ASSISTANT_HISTORY_MAX_AGE_MIN * MINUTE;
    const entries = [entry(1, NOW - limit - 1), entry(2, NOW - limit), entry(3, NOW)];
    expect(keptHistory(entries, NOW).map((item) => item.id)).toEqual([2, 3]);
  });

  it('reads back only what is a saved question', () => {
    expect(isHistoryEntry(entry(1, NOW))).toBe(true);
    expect(isHistoryEntry({ id: 1, question: 'x', atMs: NOW })).toBe(false);
    expect(isHistoryEntry({ id: '1', question: 'x', atMs: NOW, intent: { kind: 'help' } })).toBe(false);
    expect(isHistoryEntry(null)).toBe(false);
  });
});

describe('online only', () => {
  it('opens only when the server answered', () => {
    expect(accessOf(true, false)).toBe('open');
    expect(accessOf(false, false)).toBe('offline');
    expect(accessOf(false, true)).toBe('offline');
    expect(accessOf(undefined, false)).toBe('checking');
  });

  it('a build with no backend is open in development only', () => {
    expect(accessOf(null, true)).toBe('open');
    expect(accessOf(null, false)).toBe('offline');
  });
});

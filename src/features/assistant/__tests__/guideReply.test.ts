// Commuter guide (2026-11-02): every topic has an answer, and each chip asks a question that comes
// back to its own topic, so a visitor can go from one step to the next.

import { GUIDE_TOPICS } from '@/shared/assistant/guide';
import { parseQuery } from '@/shared/assistant/intent';
import { strings } from '@/strings';

import { replyOf, STARTER_CHIPS } from '../reply';

describe('commuter guide replies', () => {
  it.each(GUIDE_TOPICS)('%s: answered in a few lines, with chips that ask other topics', (topic) => {
    const reply = replyOf({ kind: 'guide', topic }, { kind: 'guide', topic }, 'regular');
    expect(reply.lines.length).toBeGreaterThanOrEqual(2);
    expect(reply.chips.length).toBeGreaterThanOrEqual(2);
    for (const chip of reply.chips) expect(chip.action.kind).toBe('ask');
  });

  it.each(GUIDE_TOPICS)('the %s chip question parses back to its topic', (topic) => {
    expect(parseQuery(strings.assistant.chips.guide[topic])).toEqual({ kind: 'guide', topic });
  });

  it('the fare answer uses the fare settings: ₱14.00 for 4 km, ₱2.00 a km, 20% off', () => {
    const lines = replyOf({ kind: 'guide', topic: 'fareRules' }, { kind: 'guide', topic: 'fareRules' }, 'regular').lines.join(' ');
    expect(lines).toContain('₱14.00');
    expect(lines).toContain('4 km');
    expect(lines).toContain('₱2.00');
    expect(lines).toContain('20%');
  });

  it('the starter chips offer the visitor tips', () => {
    const tips = STARTER_CHIPS.find((chip) => chip.label === strings.assistant.chips.guide.visitor);
    expect(tips?.action).toEqual({ kind: 'ask', question: strings.assistant.chips.guide.visitor, intent: { kind: 'guide', topic: 'visitor' } });
  });
});

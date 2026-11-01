// Commuter guide (2026-11-02): questions about how to ride become a guide topic, and the questions
// Tunie already answered (trips, fares, route status, nearest stop) keep their meaning.

import { GUIDE_TOPICS, guideTopicOf } from '../assistant/guide';
import { parseQuery } from '../assistant/intent';

const topicOf = (text: string) => {
  const intent = parseQuery(text);
  return intent.kind === 'guide' ? intent.topic : intent.kind;
};

describe('commuter guide topics', () => {
  it.each([
    ['What do I say to the driver?', 'askDriver'],
    ['what should i say to the driver to stop', 'getOff'],
    ['How do I get off?', 'getOff'],
    ['para', 'getOff'],
    ['how do I pay', 'pay'],
    ['how do I pay on R4?', 'pay'],
    ['unsaon pagbayad?', 'pay'],
    ['how do I flag a multicab', 'flag'],
    ['is there a student discount?', 'fareRules'],
    ['I took the wrong route', 'lost'],
    ['is it safe?', 'safety'],
    ['riding at night', 'night'],
    ['where do I sit', 'etiquette'],
    ['useful bisaya phrases', 'phrases'],
    ['I am a tourist', 'visitor'],
    ['tips for first-time riders', 'visitor'],
    ['what is a multicab?', 'multicab'],
    ['can I tap a coin to stop?', 'getOff'],
    ['do I knock on the roof?', 'getOff'],
    ['bayad usa ra', 'pay'],
    ['where do I put my bag', 'etiquette'],
    ['can I eat inside', 'etiquette'],
  ])('"%s" is %s', (text, topic) => {
    expect(topicOf(text)).toBe(topic);
  });

  it('keeps trips, fares, route status, the nearest stop and greetings as before', () => {
    expect(topicOf('from Libertad to CSU')).toBe('trip');
    expect(topicOf('pila plete paingon Ampayon')).toBe('trip');
    expect(topicOf('how much to pay to SM')).toBe('trip');
    expect(topicOf('jeep to Libertad')).toBe('trip');
    expect(topicOf('I am lost, how do I get to SM?')).toBe('trip');
    expect(topicOf('naa bay R4?')).toBe('status');
    expect(topicOf('Is R4 running?')).toBe('status');
    expect(topicOf('nearest stop')).toBe('nearest');
    expect(topicOf('maayong gabii')).toBe('help');
    expect(topicOf('hello')).toBe('help');
  });

  it('a question with no guide words has no topic', () => {
    expect(guideTopicOf(['robinsons'])).toBeNull();
    expect(GUIDE_TOPICS).toHaveLength(12);
  });
});

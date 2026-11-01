// Commuter guide (2026-11-02): Tunie's answers about how to ride a multicab in Butuan, for a visitor or
// a first-time rider: what to say, how to pay and get off, fares, safety. Fixed topics found by words
// (lexicon.ts GUIDE_WORDS); the replies are in src/strings. No network and no model. Pure.

import { GUIDE_WORDS } from './lexicon';

export type GuideTopic = keyof typeof GUIDE_WORDS;

// Tried in this order: the first topic with a matching phrase wins
export const GUIDE_TOPICS = Object.keys(GUIDE_WORDS) as GuideTopic[];

// Whether `phrase` (one or more words) appears as whole words in `words`
function hasPhrase(words: readonly string[], phrase: string): boolean {
  const parts = phrase.split(' ');
  for (let i = 0; i + parts.length <= words.length; i += 1) {
    if (parts.every((part, k) => words[i + k] === part)) return true;
  }
  return false;
}

// The guide topic of a question already split into normalised words, or null
export function guideTopicOf(words: readonly string[]): GuideTopic | null {
  return GUIDE_TOPICS.find((topic) => GUIDE_WORDS[topic].some((phrase) => hasPhrase(words, phrase))) ?? null;
}

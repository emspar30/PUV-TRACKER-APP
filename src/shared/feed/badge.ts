// The neutral badge of a feed author (PRD 19 D2): an initial and one of FEED_BADGE_COLOR_COUNT
// colours, both worked out from the username, so the same handle always looks the same. Never the
// preset avatar, and never on the live map. Pure: the colours themselves live in the theme.

import { FEED_BADGE_COLOR_COUNT } from '../config';

// FNV-1a, 32 bit: a small, stable string hash
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
// Demo handles share this prefix; the initial comes from the part after it
const DEMO_PREFIX = 'demo_';

function hash(text: string): number {
  let value = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, FNV_PRIME) >>> 0;
  }
  return value;
}

export type FeedBadge = { initial: string; colorIndex: number };

export function feedBadge(username: string, colorCount = FEED_BADGE_COLOR_COUNT): FeedBadge {
  const name = username.toLowerCase();
  const shown = name.startsWith(DEMO_PREFIX) ? name.slice(DEMO_PREFIX.length) : name;
  const letter = /[\p{L}\p{N}]/u.exec(shown)?.[0] ?? '?';
  return { initial: letter.toUpperCase(), colorIndex: colorCount > 0 ? hash(name) % colorCount : 0 };
}

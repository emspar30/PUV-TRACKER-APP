// ST2-B: a ready-made username for the introduction, so no one continues with an empty one. A word
// pair and a few digits, like "SunnyBiyahero482". The random source is passed in, so tests are
// repeatable. The user can edit it or ask for another.

import { USERNAME_SUGGEST_ATTEMPTS, USERNAME_SUGGEST_DIGITS } from '../config';
import { isValidUsername } from '../backend/rules';
import type { RandomSource } from './avatarPick';

const FIRST: readonly string[] = ['Sunny', 'Swift', 'Happy', 'Chill', 'Brave', 'Lucky', 'Bright', 'Calm', 'Kind', 'Jolly', 'Cool', 'Quick'];
const SECOND: readonly string[] = ['Biyahero', 'Pasahero', 'Rider', 'Traveler', 'Wanderer', 'Commuter', 'Mango', 'Durian', 'Lanzones', 'River', 'Explorer'];
const BASE = 10;
const FALLBACK = 'Biyahero';

function pick<T>(items: readonly T[], random: RandomSource): T {
  return items[Math.max(0, Math.min(Math.floor(random() * items.length), items.length - 1))];
}

function digits(random: RandomSource): string {
  let out = '';
  for (let i = 0; i < USERNAME_SUGGEST_DIGITS; i += 1) out += String(Math.min(Math.floor(random() * BASE), BASE - 1));
  return out;
}

export function suggestUsername(random: RandomSource): string {
  for (let attempt = 0; attempt < USERNAME_SUGGEST_ATTEMPTS; attempt += 1) {
    const name = `${pick(FIRST, random)}${pick(SECOND, random)}${digits(random)}`;
    if (isValidUsername(name)) return name;
  }
  return `${FALLBACK}${digits(random)}`;
}

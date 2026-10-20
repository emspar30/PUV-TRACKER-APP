// CA1: the offline assistant's question parser. A typed question becomes one intent by fixed rules,
// tried in order: a route's status ("Is R4 running?"), the nearest stop, a trip ("from X to Y",
// "to Y", "pila plete gikan X paingon Y"), help. No network and no model: the same words always give
// the same intent. Place names stay as text here; resolve.ts finds them. Pure: no React Native or Expo.

import { normalizeSearch } from '../routing/placeSearch';

import {
  FARE_WORDS,
  FILLER_WORDS,
  FROM_MARKERS,
  GREETINGS,
  HERE_WORDS,
  NEAREST_WORDS,
  RIDE_WORDS,
  ROUTE_WORDS,
  RUNNING_WORDS,
  SHORT_TO_MARKER,
  STOP_WORDS,
  TO_MARKERS,
  WHERE_WORDS,
} from './lexicon';

// A place in a question: the text typed, or a place picked from "Did you mean" (by its search id)
export type PlaceSlot = { text: string } | { placeId: string; title: string };

export type TripIntent = {
  kind: 'trip';
  // Null: from the user's own position
  from: PlaceSlot | null;
  // Null: the question gave no destination ("gikan sa SM")
  to: PlaceSlot | null;
  // What the reply leads with
  focus: 'fare' | 'route';
};

export type Intent =
  | TripIntent
  // Null when no route was named ("naa bay multicab?")
  | { kind: 'status'; routeCode: string | null }
  // Null: the stop nearest the user; else the stop nearest a named place
  | { kind: 'nearest'; near: PlaceSlot | null }
  | { kind: 'help' };

type Hit = { at: number; length: number };

const ROUTE_CODE = /^r(\d{1,2})$/;
const ROUTE_NUMBER = /^\d{1,2}$/;

// The earliest whole-word match of any phrase; at the same place the longer phrase wins
function findPhrase(words: readonly string[], phrases: readonly string[]): Hit | null {
  let best: Hit | null = null;
  for (const phrase of phrases) {
    const parts = phrase.split(' ');
    for (let i = 0; i + parts.length <= words.length; i += 1) {
      if (!parts.every((part, k) => words[i + k] === part)) continue;
      if (!best || i < best.at || (i === best.at && parts.length > best.length)) best = { at: i, length: parts.length };
      break;
    }
  }
  return best;
}

const has = (words: readonly string[], phrases: readonly string[]) => findPhrase(words, phrases) !== null;

const singleWords = (lists: readonly (readonly string[])[]) => new Set(lists.flatMap((list) => list.flatMap((phrase) => phrase.split(' '))));

// Taken off either end of a place: fillers and the question's own keywords, never a word inside a name
const EDGE_WORDS = singleWords([FILLER_WORDS, FARE_WORDS, RIDE_WORDS, RUNNING_WORDS, WHERE_WORDS, TO_MARKERS, FROM_MARKERS]);
// Taken out anywhere in a nearest-stop question, leaving the place it is about
const NEAREST_NOISE = singleWords([NEAREST_WORDS, STOP_WORDS, WHERE_WORDS]);
const GREETING_WORDS = singleWords([GREETINGS]);

// The place in a run of words, or null when nothing is left or it means "here"
function slotOf(words: readonly string[]): PlaceSlot | null {
  let start = 0;
  let end = words.length;
  while (start < end && EDGE_WORDS.has(words[start])) start += 1;
  while (end > start && EDGE_WORDS.has(words[end - 1])) end -= 1;
  const text = words.slice(start, end).join(' ');
  if (!text || HERE_WORDS.includes(text)) return null;
  return { text };
}

// "R4", "r 4", "route 4", "ruta 14"
export function routeCodeIn(words: readonly string[]): string | null {
  for (let i = 0; i < words.length; i += 1) {
    const joined = ROUTE_CODE.exec(words[i]);
    if (joined) return `R${Number(joined[1])}`;
    if (ROUTE_WORDS.includes(words[i]) && i + 1 < words.length && ROUTE_NUMBER.test(words[i + 1])) return `R${Number(words[i + 1])}`;
  }
  return null;
}

const ASK_WORDS = singleWords([RIDE_WORDS, FARE_WORDS]);

// "pa SM": the short marker, only first or after a ride or fare word, and only before a place
function shortToMarker(words: readonly string[]): Hit | null {
  for (let i = 0; i + 1 < words.length; i += 1) {
    if (words[i] !== SHORT_TO_MARKER || EDGE_WORDS.has(words[i + 1])) continue;
    if (i === 0 || ASK_WORDS.has(words[i - 1])) return { at: i, length: 1 };
  }
  return null;
}

function tripOf(words: readonly string[]): TripIntent | null {
  const toHit = findPhrase(words, TO_MARKERS) ?? shortToMarker(words);
  const fromHit = findPhrase(words, FROM_MARKERS);
  if (!toHit && !fromHit) return null;
  const focus = has(words, FARE_WORDS) ? 'fare' : 'route';
  let to: PlaceSlot | null = null;
  let from: PlaceSlot | null = null;
  if (toHit) {
    const end = fromHit && fromHit.at > toHit.at ? fromHit.at : words.length;
    to = slotOf(words.slice(toHit.at + toHit.length, end));
  }
  if (fromHit) {
    const end = toHit && toHit.at > fromHit.at ? toHit.at : words.length;
    from = slotOf(words.slice(fromHit.at + fromHit.length, end));
  } else if (toHit) {
    // "SM to Libertad": what comes before "to" is the start, once the question words are taken off
    from = slotOf(words.slice(0, toHit.at));
  }
  return { kind: 'trip', from, to, focus };
}

export function parseQuery(text: string): Intent {
  const words = normalizeSearch(text).split(' ').filter(Boolean);
  if (words.length === 0) return { kind: 'help' };

  const code = routeCodeIn(words);
  const trip = tripOf(words);
  // A route named without a trip in it is a status question ("naa bay R4?", "R14")
  if (code && !trip) return { kind: 'status', routeCode: code };

  const nearest = has(words, NEAREST_WORDS) || (!trip && has(words, WHERE_WORDS) && has(words, STOP_WORDS));
  if (nearest) return { kind: 'nearest', near: slotOf(words.filter((word) => !NEAREST_NOISE.has(word))) };

  if (trip) return trip;

  const rest = slotOf(words);
  const asked = has(words, FARE_WORDS) || has(words, RIDE_WORDS);
  if (!rest) {
    if (has(words, RUNNING_WORDS)) return { kind: 'status', routeCode: null };
    // "pila plete?" with no place: a trip without a destination, so the reply asks for one
    if (asked) return { kind: 'trip', from: null, to: null, focus: has(words, FARE_WORDS) ? 'fare' : 'route' };
    return { kind: 'help' };
  }
  if (!asked && has(words, GREETINGS) && slotOf(words.filter((word) => !GREETING_WORDS.has(word))) === null) return { kind: 'help' };
  // Anything else is taken as a destination ("SM City", "unsay sakyan sa Libertad")
  return { kind: 'trip', from: null, to: rest, focus: has(words, FARE_WORDS) ? 'fare' : 'route' };
}

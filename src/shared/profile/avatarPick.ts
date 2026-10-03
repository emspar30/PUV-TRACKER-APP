// Which preset avatar a user gets (PRD 19, D3). The gender answer only chooses the set the avatar
// is drawn from; it stays on the phone. The pick happens once and is never redone on its own:
// only an explicit Shuffle changes it. The random source is passed in, so tests are repeatable.

import { AVATAR_COUNT, AVATAR_IDS_FEMALE, AVATAR_IDS_MALE } from '../config';

export const GENDERS = ['male', 'female', 'unstated'] as const;
export type Gender = (typeof GENDERS)[number];

// Returns a number in [0, 1), like Math.random
export type RandomSource = () => number;

const ALL_IDS: readonly number[] = Array.from({ length: AVATAR_COUNT }, (_, id) => id);

export function isAvatarId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < AVATAR_COUNT;
}

// The avatars a gender answer may receive. No answer (null) is treated like "Prefer not to say".
export function avatarSetFor(gender: Gender | null): readonly number[] {
  if (gender === 'male') return AVATAR_IDS_MALE;
  if (gender === 'female') return AVATAR_IDS_FEMALE;
  return ALL_IDS;
}

function pickFrom(ids: readonly number[], random: RandomSource): number {
  const index = Math.min(Math.floor(random() * ids.length), ids.length - 1);
  return ids[Math.max(index, 0)];
}

export function pickAvatar(gender: Gender | null, random: RandomSource): number {
  return pickFrom(avatarSetFor(gender), random);
}

export type AvatarChoice = { avatarId: number; avatarAssigned: boolean };

// Picks an avatar only if none has been assigned yet; an assigned one is kept for any gender answer
export function assignAvatar(current: AvatarChoice, gender: Gender | null, random: RandomSource): AvatarChoice {
  if (current.avatarAssigned) return current;
  return { avatarId: pickAvatar(gender, random), avatarAssigned: true };
}

// The Shuffle action: a different avatar from the set for the current answer, when there is one
export function shuffleAvatar(currentId: number, gender: Gender | null, random: RandomSource): number {
  const set = avatarSetFor(gender);
  const others = set.filter((id) => id !== currentId);
  return pickFrom(others.length > 0 ? others : set, random);
}

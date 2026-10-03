import { AVATAR_COUNT, AVATAR_IDS_FEMALE, AVATAR_IDS_MALE } from '../config';
import { assignAvatar, avatarSetFor, isAvatarId, pickAvatar, shuffleAvatar } from '../profile/avatarPick';

// A repeatable stand-in for Math.random (a linear congruential generator)
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const DRAWS = 1000;

describe('avatar sets', () => {
  it('Male and Female have six each, with no overlap, and together make all twelve', () => {
    expect(AVATAR_COUNT).toBe(12);
    expect(AVATAR_IDS_MALE).toHaveLength(6);
    expect(AVATAR_IDS_FEMALE).toHaveLength(6);
    expect(AVATAR_IDS_MALE.filter((id) => AVATAR_IDS_FEMALE.includes(id))).toEqual([]);
    expect([...AVATAR_IDS_MALE, ...AVATAR_IDS_FEMALE].sort((a, b) => a - b)).toEqual(avatarSetFor('unstated'));
  });

  it('"Prefer not to say" and no answer both use all twelve', () => {
    expect(avatarSetFor('unstated')).toHaveLength(12);
    expect(avatarSetFor(null)).toEqual(avatarSetFor('unstated'));
  });
});

describe('pickAvatar', () => {
  it.each([
    ['male', AVATAR_IDS_MALE],
    ['female', AVATAR_IDS_FEMALE],
  ] as const)('%s picks only from its own set, and reaches all six', (gender, set) => {
    const random = seededRandom(7);
    const seen = new Set<number>();
    for (let i = 0; i < DRAWS; i += 1) seen.add(pickAvatar(gender, random));
    expect([...seen].every((id) => set.includes(id))).toBe(true);
    expect(seen.size).toBe(6);
  });

  it('"Prefer not to say" reaches all twelve', () => {
    const random = seededRandom(11);
    const seen = new Set<number>();
    for (let i = 0; i < DRAWS; i += 1) seen.add(pickAvatar('unstated', random));
    expect(seen.size).toBe(12);
  });

  it('stays in range at the edges of the random source', () => {
    expect(pickAvatar('male', () => 0)).toBe(0);
    expect(pickAvatar('male', () => 0.999999)).toBe(5);
    expect(pickAvatar('female', () => 1)).toBe(11);
    expect(isAvatarId(pickAvatar(null, () => 0.5))).toBe(true);
  });
});

describe('assignAvatar: picked once, never re-rolled on its own', () => {
  it('assigns from the set when nothing is assigned yet', () => {
    const result = assignAvatar({ avatarId: 0, avatarAssigned: false }, 'female', () => 0);
    expect(result).toEqual({ avatarId: 6, avatarAssigned: true });
  });

  it('keeps an assigned avatar for any later answer', () => {
    const assigned = { avatarId: 2, avatarAssigned: true };
    for (const gender of ['male', 'female', 'unstated', null] as const) {
      expect(assignAvatar(assigned, gender, () => 0.9)).toBe(assigned);
    }
  });
});

describe('shuffleAvatar', () => {
  it('always gives a different avatar from the current set', () => {
    const random = seededRandom(3);
    let current = 6;
    for (let i = 0; i < DRAWS; i += 1) {
      const next = shuffleAvatar(current, 'female', random);
      expect(next).not.toBe(current);
      expect(AVATAR_IDS_FEMALE).toContain(next);
      current = next;
    }
  });

  it('moves an avatar from another set into the current one', () => {
    expect(AVATAR_IDS_MALE).toContain(shuffleAvatar(9, 'male', () => 0.5));
  });
});

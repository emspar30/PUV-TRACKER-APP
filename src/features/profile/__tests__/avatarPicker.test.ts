import * as fs from 'node:fs';
import * as path from 'node:path';

import { AVATAR_IDS_FEMALE, AVATAR_IDS_MALE } from '@/shared/config';
import { avatarSetFor } from '@/shared/profile/avatarPick';

// The Settings (later Profile) picker shows only the user's own set (decision after the F1 review).
// No rendering library is installed, so the wiring is checked in the source and the sets in logic.

const picker = fs.readFileSync(path.join(__dirname, '..', 'AvatarPicker.tsx'), 'utf8');

describe('avatar picker: only the own set', () => {
  it('draws the grid from avatarSetFor(gender), not from all twelve', () => {
    expect(picker).toMatch(/const gender = useProfileStore\(\(state\) => state\.gender\)/);
    expect(picker).toMatch(/avatarSetFor\(gender\)\.map\(/);
    expect(picker).not.toMatch(/AVATAR_IDS\b|AVATAR_COUNT/);
  });

  it('the sets it shows: six for Male, six for Female, twelve otherwise', () => {
    expect(avatarSetFor('male')).toEqual(AVATAR_IDS_MALE);
    expect(avatarSetFor('female')).toEqual(AVATAR_IDS_FEMALE);
    expect(avatarSetFor('unstated')).toHaveLength(12);
    expect(avatarSetFor(null)).toHaveLength(12);
  });

  it('keeps Shuffle beside the grid', () => {
    expect(picker).toMatch(/export function ShuffleAvatarChip/);
  });
});

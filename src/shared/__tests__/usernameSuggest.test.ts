import { isValidUsername } from '../backend/rules';
import { USERNAME_SUGGEST_DIGITS } from '../config';
import { introUsername, suggestUsername } from '../profile/usernameSuggest';

// A repeatable random source that walks through [0, 1)
function sequence(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

describe('suggested username (ST2-B)', () => {
  it('is always a valid username ending in digits', () => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const name = suggestUsername(sequence(seed));
      expect(isValidUsername(name)).toBe(true);
      expect(name).toMatch(new RegExp(`^[A-Za-z]+\\d{${USERNAME_SUGGEST_DIGITS}}$`));
    }
  });

  it('is the same for the same random source', () => {
    expect(suggestUsername(sequence(7))).toBe(suggestUsername(sequence(7)));
  });

  it('stays valid at the edges of the random range', () => {
    expect(isValidUsername(suggestUsername(() => 0))).toBe(true);
    expect(isValidUsername(suggestUsername(() => 0.999999))).toBe(true);
  });
});

describe('the username the introduction shows', () => {
  it('is the suggestion on a new account', () => {
    expect(introUsername(null, null, 'SunnyRider123')).toBe('SunnyRider123');
  });

  it('is the account username once it loads after sign-in, so a new phone does not rename it', () => {
    expect(introUsername(null, 'JuanBiyahe', 'SunnyRider123')).toBe('JuanBiyahe');
  });

  it('is what the user typed, even after the account username loads', () => {
    expect(introUsername('NewName', 'JuanBiyahe', 'SunnyRider123')).toBe('NewName');
  });
});

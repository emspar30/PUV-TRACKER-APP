import * as fs from 'node:fs';
import * as path from 'node:path';

// The profile store saves to the phone's key-value store; an in-memory one stands in for it here
const mockSaved = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockSaved.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockSaved.set(key, value),
    removeItemSync: (key: string) => mockSaved.delete(key),
  },
}));

// eslint-disable-next-line import/first
import { getFareType, setFareType } from '../fareType';
// eslint-disable-next-line import/first
import { useProfileStore } from '../profileStore';

const ROOT = path.join(__dirname, '..', '..', '..');
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('fare type: one stored value for the quick chip and Settings', () => {
  it('a change made in one place is the stored classification everyone reads', () => {
    setFareType('student');
    expect(getFareType()).toBe('student');
    expect(useProfileStore.getState().classification).toBe('student');
    expect(mockSaved.get('profile')).toContain('"classification":"student"');

    // A change made directly on the profile store (as before UX2) is seen the same way
    useProfileStore.getState().setClassification('senior');
    expect(getFareType()).toBe('senior');
  });

  it('Settings and the My Ride quick chip both use the same chips, which use useFareType', () => {
    const settings = read('src/app/settings.tsx');
    const result = read('src/features/ride/RideResult.tsx');
    const chips = read('src/features/ride/FareTypeChips.tsx');

    expect(settings).toMatch(/import \{ FareTypeChips \} from '@\/features\/ride\/FareTypeChips'/);
    expect(result).toMatch(/import \{ QuickFareTypeChip \} from '\.\/FareTypeChips'/);
    expect(chips).toMatch(/import \{ useFareType \} from '@\/state\/fareType'/);
    // Neither screen keeps a classification of its own
    for (const source of [settings, result, chips]) expect(source).not.toMatch(/setClassification|useProfileStore/);
  });
});

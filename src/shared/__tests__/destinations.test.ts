import { FREQUENT_DESTINATIONS_MAX } from '../config';
import { addDestination, cleanDestinations, removeDestination, type Destination } from '../profile/destinations';

// Fixed points, not the seed file's landmarks
const place = (id: string): Destination => ({ id, label: id.toUpperCase(), lat: 9, lon: 125.5 });

describe('frequent destinations', () => {
  it('holds at most three', () => {
    expect(FREQUENT_DESTINATIONS_MAX).toBe(3);
    let list: readonly Destination[] = [];
    for (const id of ['a', 'b', 'c']) {
      const step = addDestination(list, place(id));
      expect(step.result).toBe('added');
      list = step.list;
    }
    const fourth = addDestination(list, place('d'));
    expect(fourth.result).toBe('full');
    expect(fourth.list.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('refuses the same place twice', () => {
    const { list } = addDestination([], place('a'));
    expect(addDestination(list, place('a'))).toEqual({ list, result: 'duplicate' });
  });

  it('removes by id, which frees a place', () => {
    const list = [place('a'), place('b'), place('c')];
    const fewer = removeDestination(list, 'b');
    expect(fewer.map((item) => item.id)).toEqual(['a', 'c']);
    expect(addDestination(fewer, place('d')).result).toBe('added');
  });

  it('reads a stored list back safely: bad entries, repeats and extras are dropped', () => {
    const stored = [place('a'), { id: 'x' }, place('a'), place('b'), 'junk', place('c'), place('d')];
    expect(cleanDestinations(stored).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(cleanDestinations(undefined)).toEqual([]);
  });
});

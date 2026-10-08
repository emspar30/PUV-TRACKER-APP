import { FREQUENT_DESTINATIONS_MAX } from '../config';
import { addDestination, cleanDestinations, refreshSavedLandmarks, removeDestination, type Destination } from '../profile/destinations';

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

describe('places saved as stops of older route data (EQ-16)', () => {
  const landmarks: Destination[] = [
    { id: 'stop-SMB', label: 'SMB', lat: 8.9458, lon: 125.5336 },
    { id: 'stop-OAZ', label: 'OAZ', lat: 8.944, lon: 125.528 },
  ];
  const isLandmarkId = (id: string) => id.startsWith('stop-');
  const pointId = (place: Destination) => `place-${place.lat}-${place.lon}`;
  const refresh = (list: Destination[]) => refreshSavedLandmarks(list, landmarks, isLandmarkId, pointId, (code) => `Near ${code}`);

  it('becomes the current stop within 150 m', () => {
    expect(refresh([{ id: 'stop-TSO', label: 'TSO', lat: 8.946096, lon: 125.533083 }])).toEqual([landmarks[0]]);
  });

  it('farther away stays where it is, as a map point named after the nearest stop', () => {
    expect(refresh([{ id: 'stop-IMA', label: 'IMA', lat: 8.94755, lon: 125.531184 }])).toEqual([
      { id: 'place-8.94755-125.531184', label: 'Near SMB', lat: 8.94755, lon: 125.531184 },
    ]);
  });

  it('leaves current stops and map points alone, and merges a moved stop with one already saved', () => {
    const point = { id: 'place-1', label: 'Pinned point', lat: 8.9, lon: 125.5 };
    expect(refresh([landmarks[0], point])).toEqual([landmarks[0], point]);
    expect(refresh([landmarks[0], { id: 'stop-TSO', label: 'TSO', lat: 8.946096, lon: 125.533083 }])).toEqual([landmarks[0]]);
  });
});

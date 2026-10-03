import { TAB_ROUTES } from '../../navigation/tabs';

describe('bottom tabs', () => {
  it('are exactly Live, Check-in and My Ride, in that order', () => {
    expect(TAB_ROUTES.map(({ name, title }) => [name, title])).toEqual([
      ['index', 'Live'],
      ['checkin', 'Check-in'],
      ['ride', 'My Ride'],
    ]);
  });

  it('have no Fare tab: the fare is part of My Ride', () => {
    expect(TAB_ROUTES.some(({ name, title }) => /fare/i.test(name) || /fare/i.test(title))).toBe(false);
  });
});

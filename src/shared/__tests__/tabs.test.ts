import { TAB_ROUTES } from '../../navigation/tabs';

describe('bottom tabs', () => {
  it('are exactly Map, Check-in, My Rides and Crowdsource, in that order (restyle)', () => {
    expect(TAB_ROUTES.map(({ name, title }) => [name, title])).toEqual([
      ['index', 'Map'],
      ['checkin', 'Check-in'],
      ['ride', 'My Rides'],
      ['crowdsource', 'Crowdsource'],
    ]);
  });

  it('have no Fare tab: the fare is part of My Ride', () => {
    expect(TAB_ROUTES.some(({ name, title }) => /fare/i.test(name) || /fare/i.test(title))).toBe(false);
  });
});

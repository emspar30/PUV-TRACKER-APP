import { TAB_ROUTES } from '../../navigation/tabs';

describe('bottom tabs', () => {
  it('are exactly Map, Check-in, Relay, My Rides and Crowdsource, in that order (Relay in the middle)', () => {
    expect(TAB_ROUTES.map(({ name, title }) => [name, title])).toEqual([
      ['index', 'Map'],
      ['checkin', 'Check-in'],
      ['relay', 'Relay'],
      ['ride', 'My Rides'],
      ['crowdsource', 'Crowdsource'],
    ]);
  });

  it('have no Fare tab: the fare is part of My Ride', () => {
    expect(TAB_ROUTES.some(({ name, title }) => /fare/i.test(name) || /fare/i.test(title))).toBe(false);
  });
});

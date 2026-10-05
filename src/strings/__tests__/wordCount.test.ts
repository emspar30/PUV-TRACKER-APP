// AF1: every message shown on Live, Check-in and My Ride without a tap is at most 8 words, the
// location explainer at most 12, and each first-run hint at most 6.

import { en } from '../en';

const MAX_MAIN_WORDS = 8;
const MAX_EXPLAINER_WORDS = 12;
const MAX_HINT_WORDS = 6;

const words = (text: string) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

// The strings the three tabs show before any tap (sample arguments fill the templates)
const mainScreen: Record<string, string> = {
  pickRoute: en.live.pickRoute,
  noData: en.live.status.noData,
  stale: en.live.status.stale('2 min'),
  ends: en.live.ends('Jeepney Terminal', 'Robinsons'),
  partial: en.common.partial,
  sampleData: en.common.sampleData,
  locationOff: en.location.off,
  outsideMap: en.location.outsideMap,
  pickStation: en.checkin.pickStation,
  noStations: en.checkin.noStations,
  checkIn: en.checkin.checkIn,
  notVerified: en.checkin.notVerified,
  shared: en.checkin.shared,
  waiting: en.checkin.waiting(3),
  placeholder: en.ride.placeholder,
  allRoutes: en.ride.allRoutes,
  mapComingSoon: en.ride.mapComingSoon,
  originTooFar: en.ride.failure.origin_too_far(1200),
  destinationTooFar: en.ride.failure.destination_too_far(1200),
  notAhead: en.ride.failure.destination_not_ahead(),
  noRoutes: en.ride.failure.no_routes(),
  notMapped: en.ride.notMapped('R4'),
  differentRoutes: en.ride.differentRoutes,
  draft: en.common.draft,
  demo: en.common.demo,
  backendMissing: en.profile.backendMissing,
  signedOut: en.profile.signedOut,
};

describe('AF1 word limits', () => {
  it.each(Object.entries(mainScreen))('main-screen text "%s" is at most 8 words', (_name, text) => {
    expect(words(text)).toBeLessThanOrEqual(MAX_MAIN_WORDS);
  });

  it('the location explainer is at most 12 words', () => {
    expect(words(`${en.location.explainerTitle} ${en.location.explainerBody}`)).toBeLessThanOrEqual(MAX_EXPLAINER_WORDS);
  });

  it.each(['live', 'checkin', 'ride'] as const)('the %s hint is at most 6 words', (tab) => {
    expect(words(en.hints[tab])).toBeLessThanOrEqual(MAX_HINT_WORDS);
  });

  it('counts words, not symbols', () => {
    expect(words('Location off · Long-press to set start')).toBe(6);
  });
});

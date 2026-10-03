// Every piece of text the commuter sees, in one place.
// To add Cebuano later: copy this file to ceb.ts, translate the values, and switch the export
// in src/strings/index.ts. No translation library is needed for that.

import type { Classification } from '@/shared/config';
import type { PlanFailure } from '@/shared/routing/plan';
import type { RouteDirection } from '@/shared/routing/types';
import type { SnapName } from '@/shared/ui/sheetSnap';

const km = (value: number) => `${value.toFixed(1)} km`;
const peso = (value: number) => `₱${value.toFixed(2)}`;
const WALK_STEP_M = 10;
const METERS_PER_KM = 1000;

// "120 m", to the nearest 10 m, because a walking distance is an estimate
const meters = (value: number) => {
  if (value < WALK_STEP_M) return 'under 10 m';
  if (value >= METERS_PER_KM) return km(value / METERS_PER_KM);
  return `${Math.round(value / WALK_STEP_M) * WALK_STEP_M} m`;
};

export const en = {
  format: { km, peso, meters },

  app: {
    name: 'Tunton APP',
    tagline: 'Find your multicab route and fare in Butuan, even with no signal.',
  },

  tabs: {
    live: 'Live',
    checkin: 'Check-in',
    ride: 'My Ride',
    // Names of the screens that UX2 replaces
    map: 'Map',
    plan: 'Plan',
  },

  common: {
    placeholderData: 'Placeholder data',
    placeholderDetail: 'Route, stops and fares are placeholder data, not yet confirmed.',
    tryAgain: 'Try again',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    skip: 'Skip',
    done: 'Done',
    attribution: '© OpenStreetMap contributors',
    sampleData: 'Sample data',
    comingSoon: 'Coming soon',
  },

  // The draggable panel over the map
  sheet: {
    label: 'Panel',
    position: { peek: 'Collapsed', half: 'Half open', expanded: 'Open' } satisfies Record<SnapName, string>,
    next: 'Change panel size',
    expand: 'Expand',
    collapse: 'Collapse',
  },

  live: {
    status: {
      live: 'Live',
      stale: (age: string) => `Stale · ${age}`,
      noData: 'No data',
    },
    noData: 'No data from riders right now',
    route: (code: string) => `Route ${code}`,
    ends: (from: string, to: string) => `${from} → ${to}`,
    length: (distanceKm: number) => km(distanceKm),
    legendStop: 'Stop',
    legendDirection: 'Direction of travel',
    stopsTitle: 'Stops',
    stopAlong: (distanceKm: number) => `${km(distanceKm)} along`,
    closeStop: 'Close stop details',
  },

  settings: {
    title: 'Settings',
    open: 'Open settings',
    fareType: 'Fare type',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    avatar: 'Avatar',
    about: 'About',
    replayIntro: 'Replay intro',
    account: 'Team account',
    close: 'Close settings',
  },

  direction: {
    outbound: 'Outbound',
    return: 'Return',
    lower: { outbound: 'outbound', return: 'return' } satisfies Record<RouteDirection, string>,
  },

  loading: {
    routeData: 'Loading route data',
    routeDataFailed: 'The route data could not be loaded.',
    tiles: 'Preparing the offline map',
    tilesFirstRun: 'This happens once, the first time the app opens.',
    tilesFailed: 'The offline map could not be set up.',
    mapUnavailableOnPlan: 'The offline map is unavailable. You can still pick stops below.',
  },

  map: {
    route: (code: string) => `Route ${code}`,
    offlineReady: 'Offline ready',
    offlineReadyHint: 'The map and route data are stored on this phone. No internet is needed.',
    showWholeRoute: 'Show whole route',
    legendTitle: 'Legend',
    legendOutbound: 'Outbound: solid line',
    legendReturn: 'Return: dashed line',
    legendStops: 'Stops: white dots',
    legendArrows: 'Arrows show the direction of travel',
    showDirection: (label: string) => `${label} line`,
    stopsTitle: 'Stops',
    stop: (code: string) => `Stop ${code}`,
    stopAlongRoute: (distanceKm: number) => `${km(distanceKm)} from the start of the outbound line`,
    stopHint: 'Tap a dot on the map or a stop below to see its details.',
    planFromHere: 'Plan a trip',
  },

  plan: {
    origin: 'Origin',
    destination: 'Destination',
    notSet: 'Tap the map or pick a stop',
    intro: 'Choose an origin and a destination by tapping the map or picking a stop. Planning works with no internet.',
    stopLabel: (code: string) => `Stop ${code}`,
    nearStop: (code: string, routeDistanceM: number) => `Near ${code}, ${meters(routeDistanceM)} from the route`,
    onRouteNearStop: (code: string) => `On the route, near ${code}`,
    pinnedPoint: 'Pinned point',
    coordinates: (lat: number, lon: number) => `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    swap: 'Swap origin and destination',
    clear: 'Clear both points',
    collapse: 'Show more of the map',
    expand: 'Show trip details',
    pickStopFor: (target: string, code: string, name: string) => `Set ${target} to stop ${code}, ${name}`,

    itinerary: 'Itinerary',
    walkToRoute: (distanceM: number) => `Walk ${meters(distanceM)} to the route`,
    ride: (code: string, direction: string, distanceKm: number) =>
      `Ride Route ${code} (${direction}) for ${km(distanceKm)}`,
    walkToDestination: (distanceM: number) => `Walk ${meters(distanceM)} to the destination`,
    summary: (distanceKm: number, fare: number) => `${km(distanceKm)} ride, about ${peso(fare)}`,

    fare: 'Fare',
    estimateOnly: 'Estimate only',
    notOfficial: 'This is an estimate, not the official fare. Walking does not change it.',
    showBreakdown: 'Show how this was worked out',
    hideBreakdown: 'Hide the working',
    breakdownBase: (baseKm: number) => `Base fare, first ${baseKm} km`,
    breakdownExtra: (extraKm: number, rate: number) => `${extraKm} more km at ${peso(rate)} each`,
    breakdownExtraNone: (baseKm: number) => `No extra km (the ride is within ${baseKm} km)`,
    breakdownRegular: 'Regular fare',
    breakdownDiscount: (label: string, percent: number) => `${label} discount (${percent}% off)`,
    breakdownNoDiscount: (label: string) => `${label}: no discount`,
    breakdownRounding: (step: number) => `Rounded to the nearest ${peso(step)}`,
    breakdownTotal: 'Estimated fare',
    changeClassification: 'Change your fare classification in Profile.',

    failureTitle: 'No trip found',
    failure: {
      origin_too_far: (distanceM: number | null, maxWalkM: number) =>
        `The origin is ${distanceM === null ? 'too far' : meters(distanceM)} from the route. The walking limit is ${maxWalkM} m.`,
      destination_too_far: (distanceM: number | null, maxWalkM: number) =>
        `The destination is ${distanceM === null ? 'too far' : meters(distanceM)} from the route. The walking limit is ${maxWalkM} m.`,
      destination_not_ahead: () =>
        'The destination is behind the origin in the direction this route travels, so no ride goes from one to the other.',
      no_routes: () => 'No route data is available on this phone.',
    } satisfies Record<PlanFailure, (distanceM: number | null, maxWalkM: number) => string>,
    moveOriginToRoute: 'Move origin to the route',
    moveDestinationToRoute: 'Move destination to the route',
    useNearestStopForOrigin: (code: string) => `Use stop ${code} as origin`,
    useNearestStopForDestination: (code: string) => `Use stop ${code} as destination`,
    swapToFix: 'Swap origin and destination',
  },

  classification: {
    title: 'Fare classification',
    note: 'Used only to estimate your fare. Stored on this phone only and never sent anywhere.',
    labels: {
      regular: 'Regular',
      student: 'Student',
      senior: 'Senior Citizen',
      pwd: 'Person with Disability',
    } satisfies Record<Classification, string>,
    short: { regular: 'Regular', student: 'Student', senior: 'Senior', pwd: 'PWD' } satisfies Record<Classification, string>,
    discounted: 'Discounted fare estimate',
    regular: 'Regular fare estimate',
  },

  avatar: {
    title: 'Avatar',
    note: 'A picture for your profile only. It is stored on this phone, never shown on the map and never sent anywhere.',
    option: (number: number) => `Avatar ${number}`,
  },

  profile: {
    title: 'Profile',
    teamAccount: 'Team account',
    backendMissing:
      'The backend is not set up on this build, so live vehicle positions are unavailable. The map, routing and fares work without it.',
    checkingSignIn: 'Checking sign-in',
    signedInAs: (email: string | null) => `Signed in as ${email ?? 'a team account'}`,
    signedOut: 'Not signed in. Sign in with a team account to see live vehicle positions.',
    signIn: 'Sign in',
    signOut: 'Sign out',
    more: 'More',
    about: 'About this app',
    replayOnboarding: 'Show the introduction again',
  },

  signIn: {
    title: 'Team sign-in',
    note: 'For team accounts only. Live vehicle positions need a signed-in account; the map, routing and fares work without one.',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in',
    cancel: 'Cancel',
  },

  onboarding: {
    step: (current: number, total: number) => `Step ${current} of ${total}`,
    welcomeTitle: 'Welcome to Tunton',
    welcomeBody:
      'See the Route 4 multicab line on an offline map, plan a trip by picking where you start and where you are going, and get a fare estimate. It all works with no internet.',
    welcomeNote: 'This is an early prototype. The route, stops and fares are placeholders until they are confirmed.',
    aboutYouTitle: 'About you',
    aboutYouBody: 'Pick your fare classification so the fare estimate is right for you, and an avatar for your profile.',
    privacyTitle: 'What stays on your phone',
    privacyPoints: [
      'Your fare classification and avatar are stored on this phone only.',
      'The map and route data are stored on this phone, so they work offline.',
      'This version does not ask for or use your location.',
      'Nothing about you is shown on the map.',
    ],
    start: 'Start using the app',
  },

  about: {
    title: 'About',
    version: (version: string) => `Version ${version}`,
    mapTitle: 'Map data',
    mapBody:
      'The base map is made from OpenStreetMap data, which volunteers keep up to date and anyone may use with credit. It is stored on this phone for offline use.',
    routeTitle: 'Route and fare data',
    routeBody:
      'The Route 4 line, its stops and the fare values in this version are placeholders, entered so the app can be built and tested. They are not official and may be wrong. They will be replaced with confirmed data.',
    fareBody: 'Fare amounts are estimates and do not replace the official fare.',
    storedTitle: 'Stored on this phone',
    storedPoints: [
      'The offline map of the Butuan area',
      'Route lines, stops and fare values',
      'Your fare classification',
      'Your avatar choice',
      'Whether you have seen the introduction',
    ],
    notStored: 'This version does not collect your location and stores nothing about you on a server.',
  },

  dev: {
    overlay: (install: string, mapStatus: string) => `DEV  tiles: ${install}  map: ${mapStatus}`,
    camera: (zoom: number, lon: number, lat: number) =>
      `zoom ${zoom.toFixed(2)}  centre ${lon.toFixed(4)}, ${lat.toFixed(4)}`,
    cameraIdle: 'camera not moved yet',
    benchmark: (runs: number) => `DEV  Run routing benchmark (${runs} trips)`,
    benchmarkResult: (p50: number, p95: number, max: number, budget: number, found: number, runs: number) =>
      `p50 ${p50.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms, max ${max.toFixed(3)} ms. Budget ${budget} ms at p95. ${found} of ${runs} trips found.`,
  },
};

export type Strings = typeof en;

// Every piece of text the commuter sees, in one place.
// To add Cebuano later: copy this file to ceb.ts, translate the values, and switch the export
// in src/strings/index.ts. No translation library is needed for that.

import type { Classification } from '@/shared/config';
import type { Gender } from '@/shared/profile/avatarPick';
import type { GreetingPeriod } from '@/shared/profile/greeting';
import type { PlanFailure } from '@/shared/routing/plan';
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
  },

  tabs: {
    live: 'Live',
    checkin: 'Check-in',
    ride: 'My Ride',
  },

  common: {
    tryAgain: 'Try again',
    back: 'Back',
    skip: 'Skip',
    attribution: '© OpenStreetMap contributors',
    sampleData: 'Sample data',
    // A route with only one stored leg (R4, R5): the rest is not traced yet
    partial: 'Partial',
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
    // UX3: the map stays clean until a route is picked
    pickRoute: 'Pick a route',
    routeChip: (code: string, selected: boolean) => (selected ? `Route ${code}, shown. Tap to hide` : `Show route ${code}`),
    ends: (from: string, to: string) => `${from} → ${to}`,
    length: (distanceKm: number) => km(distanceKm),
    legendStop: 'Stop',
    legendDirection: 'Direction of travel',
    stopsTitle: 'Stops',
    stopAlong: (distanceKm: number) => `${km(distanceKm)} along`,
    closeStop: 'Close stop details',
  },

  // Location on the Live tab (from the partner's GPS work, b21b0c1). Foreground only.
  location: {
    locateMe: 'Locate me',
    following: 'Following your location',
    // AF1: at most 12 words in the explainer, at most 8 words in any notice
    explainerTitle: 'Show your location?',
    explainerBody: 'Used only while the app is open.',
    continue: 'Continue',
    notNow: 'Not now',
    off: 'Location off · Long-press to set start',
    turnOn: 'Turn on',
    openSettings: 'Open settings',
    outsideMap: 'Outside the offline map',
  },

  // My Ride: route discovery and the fare. Short labels; distances live behind "Details".
  ride: {
    from: 'From',
    to: 'To',
    placeholder: 'Tap map or stop',
    near: (code: string) => `Near ${code}`,
    pinned: 'Pinned point',
    swap: 'Swap From and To',
    clear: 'Clear',
    pickFor: (field: string, code: string) => `Set ${field} to ${code}`,
    boardNear: (code: string) => `Board near ${code}`,
    getOffNear: (code: string) => `Get off near ${code}`,
    walk: (distanceM: number) => `Walk ${meters(distanceM)}`,
    rideKm: (distanceKm: number) => km(distanceKm),
    estimate: 'Estimate',
    fare: (amount: number) => `Fare ${peso(amount)}`,
    details: 'Details',
    hideDetails: 'Hide details',
    viewOnMap: 'View on map',
    changeFareType: (label: string) => `Fare type ${label}, change`,
    walkToRoute: (field: string, distanceM: number) => `${field}: ${meters(distanceM)} to the route`,
    // At most about eight words, with the number that matters
    failure: {
      origin_too_far: (distanceM: number | null) => `From is too far from route · ${distanceM === null ? '?' : meters(distanceM)}`,
      destination_too_far: (distanceM: number | null) =>
        `To is too far from route · ${distanceM === null ? '?' : meters(distanceM)}`,
      destination_not_ahead: () => 'Wrong direction for this route',
      no_routes: () => 'No route data on this phone',
    } satisfies Record<PlanFailure, (distanceM: number | null) => string>,
    walkLimit: (maxWalkM: number) => `Walking limit ${maxWalkM} m`,
    moveToRoute: 'Move pin to the route',
    allRoutes: 'All routes',
    mapComingSoon: 'Map coming soon',
    showRoute: (code: string) => `Show route ${code} on the map`,
    routeEnds: (from: string, to: string) => `${from} ↔ ${to}`,
  },

  // Check-in: a local countdown in UX2; the cloud check-in, geofence and reminder arrive in G1
  checkin: {
    pickStation: 'Pick a station',
    // RR1: R3 and R5 have no stations yet
    noStations: 'No stations on this route yet',
    checkIn: 'Check in',
    checkInAt: (code: string) => `Check in at ${code}`,
    boarded: 'I boarded',
    cancel: 'Cancel',
    countdown: (time: string) => `${time} left`,
    countdownLabel: (code: string, time: string) => `Checked in at ${code}, ${time} left`,
    notVerified: 'Not location-verified',
    phoneOnly: 'On this phone only',
    route: 'Route',
    stations: 'Stations',
    // AF1: the count pill only; read aloud as "Waiting here, No data"
    waitingCount: (count: string) => `Waiting here, ${count}`,
    pickStationFirst: 'Pick a station first',
  },

  settings: {
    title: 'Settings',
    open: 'Open settings',
    fareType: 'Fare type',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    avatar: 'Avatar',
    shuffle: 'Shuffle',
    shuffleLabel: 'Shuffle avatar',
    about: 'About',
    replayIntro: 'Replay intro',
    account: 'Team account',
    close: 'Close settings',
  },

  direction: {
    outbound: 'Outbound',
    return: 'Return',
  },

  loading: {
    routeData: 'Loading route data',
    routeDataFailed: 'The route data could not be loaded.',
    tiles: 'Preparing the offline map',
    tilesFailed: 'The offline map could not be set up.',
  },

  map: {
    showWholeRoute: 'Show whole route',
    stop: (code: string) => `Stop ${code}`,
  },

  // The fare breakdown, shown under Details on My Ride
  plan: {
    breakdownBase: (baseKm: number) => `Base fare, first ${baseKm} km`,
    breakdownExtra: (extraKm: number, rate: number) => `${extraKm} more km at ${peso(rate)} each`,
    breakdownExtraNone: (baseKm: number) => `No extra km (the ride is within ${baseKm} km)`,
    breakdownRegular: 'Regular fare',
    breakdownDiscount: (label: string, percent: number) => `${label} discount (${percent}% off)`,
    breakdownNoDiscount: (label: string) => `${label}: no discount`,
    breakdownRounding: (step: number) => `Rounded to the nearest ${peso(step)}`,
    breakdownTotal: 'Estimated fare',
  },

  classification: {
    labels: {
      regular: 'Regular',
      student: 'Student',
      senior: 'Senior Citizen',
      pwd: 'Person with Disability',
    } satisfies Record<Classification, string>,
    short: { regular: 'Regular', student: 'Student', senior: 'Senior', pwd: 'PWD' } satisfies Record<Classification, string>,
  },

  avatar: {
    option: (number: number) => `Avatar ${number}`,
  },

  profile: {
    // AF1: short; the offline features never need an account
    backendMissing: 'Team account · not set up',
    checkingSignIn: 'Checking sign-in',
    signedInAs: (email: string | null) => `Signed in as ${email ?? 'a team account'}`,
    signedOut: 'Not signed in',
    signIn: 'Sign in',
    signOut: 'Sign out',
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

  // Tunton, the app's persona (PRD 19, D11): short and friendly
  persona: {
    name: 'Tunton',
    // Two lines per period; one is shown per day. Emjay picks the final set.
    greetings: {
      morning: ['Good morning! Where are we going?', 'Morning! Ready to ride?'],
      afternoon: ['Good afternoon! Where to next?', 'Where are we going right now?'],
      evening: ['Good evening! Heading home?', 'Evening! Where are we off to?'],
      night: ["Late ride? Let's find your route.", 'Still out? Where are we going?'],
    } satisfies Record<GreetingPeriod, readonly string[]>,
  },

  // AF1: one short first-run line per tab, at most 6 words, never shown again once dismissed
  hints: {
    live: 'Pick a route to see it',
    checkin: 'Pick your route, then station',
    ride: 'Where are you going?',
    dismiss: 'Dismiss tip',
  },

  greeting: {
    planRide: 'Plan a ride',
    goTo: (name: string) => `Plan a ride to ${name}`,
    hide: 'Hide greeting',
  },

  onboarding: {
    title: 'Welcome to Tunton',
    savedOnPhone: 'Saved on your phone only',
    start: 'Start',
    next: 'Next',
    step: (current: number, total: number) => `Step ${current} of ${total}`,
    welcomeTitle: "Hi, I'm Tunton!",
    welcomeBody: 'Find your multicab ride and fare.',
    genderTitle: 'About you',
    genderHint: 'Optional. Picks your avatar.',
    genders: { male: 'Male', female: 'Female', unstated: 'Prefer not to say' } satisfies Record<Gender, string>,
    yourAvatar: 'Your avatar',
    shuffleLater: 'Shuffle it anytime in Settings',
    typeTitle: 'How do you ride?',
    typeHint: 'For your fare estimate',
    placesTitle: 'Where do you often go?',
    placesHint: (max: number) => `Pick up to ${max}`,
    placeLabel: (name: string) => `Frequent destination ${name}`,
  },

  about: {
    title: 'About',
    version: (version: string) => `Version ${version}`,
    sampleData: 'Sample route data, not official',
    // LB1a: the bundled label fonts (licence text in assets/glyphs/glyphs-v1/OFL.txt)
    fontCredit: 'Map labels use Noto Sans, SIL Open Font License 1.1',
    staysOnPhone: 'Your profile choices stay on your phone',
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

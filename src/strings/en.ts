// Every piece of text the commuter sees, in one place.
// To add Cebuano later: copy this file to ceb.ts, translate the values, and switch the export
// in src/strings/index.ts. No translation library is needed for that.

import type { Classification } from '@/shared/config';
import type { GreetingPeriod } from '@/shared/profile/greeting';
import type { PlanFailure } from '@/shared/routing/plan';
import type { SnapName } from '@/shared/ui/sheetSnap';
import type { TourStepId } from '@/shared/ui/tourPlacement';

const km = (value: number) => `${value.toFixed(1)} km`;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const peso = (value: number) => `₱${value.toFixed(2)}`;
const WALK_STEP_M = 10;
const METERS_PER_KM = 1000;
const SECONDS_PER_MINUTE = 60;

// "120 m", to the nearest 10 m, because a walking distance is an estimate
const meters = (value: number) => {
  if (value < WALK_STEP_M) return 'under 10 m';
  if (value >= METERS_PER_KM) return km(value / METERS_PER_KM);
  return `${Math.round(value / WALK_STEP_M) * WALK_STEP_M} m`;
};

// ST2-C3: the kind of a map place, as shown under a search result. Kinds not listed read as written
// in the map data ("sports_centre" as "Sports centre").
const PLACE_KINDS: Record<string, string> = {
  school: 'School',
  kindergarten: 'School',
  college: 'College',
  university: 'University',
  bus_stop: 'Bus stop',
  bus_station: 'Terminal',
  place_of_worship: 'Church',
  religion: 'Church',
  fuel: 'Fuel station',
  hotel: 'Hotel',
  guest_house: 'Inn',
  fast_food: 'Fast food',
  restaurant: 'Restaurant',
  cafe: 'Café',
  convenience: 'Store',
  supermarket: 'Supermarket',
  retail: 'Mall',
  marketplace: 'Market',
  bank: 'Bank',
  atm: 'ATM',
  pharmacy: 'Pharmacy',
  hospital: 'Hospital',
  clinic: 'Clinic',
  health_post: 'Health center',
  townhall: 'Barangay hall',
  police: 'Police',
  fire_station: 'Fire station',
  post_office: 'Post office',
  residential: 'Subdivision',
  industrial: 'Industrial area',
  commercial: 'Commercial area',
  park: 'Park',
  cemetery: 'Cemetery',
};
const placeKind = (kind: string) => {
  const known = PLACE_KINDS[kind];
  if (known) return known;
  const words = kind.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Place';
};

export const en = {
  format: { km, peso, meters },

  app: {
    name: 'Tunton APP',
    tagline: 'Live multicabs and fares in Butuan',
  },

  tabs: {
    live: 'Map',
    checkin: 'Check-in',
    // B3: the tab while a check-in runs (the red dot)
    checkinActive: 'Check-in, you are checked in',
    ride: 'My Rides',
    crowdsource: 'Crowdsource',
  },

  // Crowdsource tab (restyle; the real feed and the Report button come with N1 and RP1)
  crowdsource: {
    title: 'Crowdsource',
    body: 'Reports from commuters in the last hour',
    // The user's own posts on live data come from the database (N1 reads the same table)
    signIn: 'Sign in to see live reports',
    // N1: flagging someone else's post
    flag: 'Flag report',
    flagLabel: (username: string) => `Flag the report by ${username}`,
    flagTitle: 'Flag this report?',
    flagBody: (count: number) => `Flag reports that are wrong or abusive. After ${count} flags a report is hidden and reviewed.`,
    flagConfirm: 'Flag',
    flagCancel: 'Cancel',
    flaggedTitle: 'Thanks for flagging',
    flaggedBody: 'The report is hidden for you.',
    flagFailedTitle: 'Flag not sent',
    flagFailedBody: 'Try again in a moment.',
    you: 'You',
    // B6: the compact card
    noVehicle: 'Multicab',
    trusted: 'Trusted',
    trustedLabel: 'Trusted commuter: 5 check-ins or relays nobody flagged',
    near: (stop: string) => `Near ${stop}`,
    all: 'All routes',
    empty: 'No reports yet',
    emptyBody: 'Reports from commuters show here for one hour.',
    phrases: {
      full: 'Full',
      few_seats: 'Few seats left',
      not_moving: 'Not moving',
      heavy_traffic: 'Heavy traffic',
      loading: 'Loading passengers',
    },
    seats: { green: 'Seats available', amber: 'Filling up', red: 'Full' },
    ago: (minutes: number) => (minutes < 1 ? 'Just now' : `${minutes} min ago`),
  },

  // RP1: the Report button on the Live tab and its panel
  report: {
    // ST2-D2: the destination typed and searched
    destinationSearch: 'Search where you will get off',
    destinationNear: (place: string, stop: string) => `${place} · get off at ${stop}`,
    destinationTooFar: (route: string, place: string) => `No ${route} stop near ${place}`,
    destinationClear: 'Clear the destination',
    // "Relay", not "Report": reporting a user is a different action
    button: 'Relay',
    title: 'Relay a multicab update',
    close: 'Close relay',
    route: 'Route',
    whatsHappening: "What's happening? (optional)",
    seats: 'Seats',
    // B4: the destination ends the GPS sharing; Bluetooth fills in the vehicle (slot, later)
    destination: 'Destination',
    destinationHint: 'Where you get off. Sharing with GPS stops there.',
    destinationNone: 'No stops on this route yet, so it can only be sent without GPS.',
    gpsNeedsDestination: 'Pick a destination to share with GPS.',
    bleTitle: 'Found by Bluetooth',
    bleBody: 'Route and multicab filled in',
    bleLabel: (code: string, plate: string) => `Found by Bluetooth: ${code}, ${plate}`,
    sharingTitle: 'Sharing your location',
    sharingDetail: (code: string, stop: string) => `${code} · until ${stop}`,
    stopSharing: 'Stop',
    arrivedTitle: (stop: string) => `You reached ${stop}`,
    arrivedBody: 'Location sharing stopped. Thanks for the relay!',
    expiredTitle: 'Location sharing ended',
    expiredBody: 'It stops by itself after a while. Relay again if you are still riding.',
    vehicleDev: 'Vehicle (development builds)',
    withGps: 'Share with GPS',
    gpsEarns: (gps: number, noGps: number) => `Earns +${gps.toFixed(1)} Energy with GPS, +${noGps.toFixed(1)} without (once a day each)`,
    gpsUnavailable: (noGps: number) => `No precise location right now. Sent without GPS: +${noGps.toFixed(1)} Energy (once a day).`,
    // D1: while Energy is hidden (tracking is free), the same lines without the rewards
    gpsShares: 'Shows your multicab on the live map until your stop',
    gpsUnavailableFree: 'No precise location right now. Sent without GPS.',
    unverified: 'Relays show as unverified for now.',
    send: 'Relay update',
    sending: 'Sending…',
    sentTitle: 'Update relayed',
    sentBody: (minutes: number) => `It shows in Crowdsource for ${minutes} minutes.`,
    // With GPS the update belongs to the live map (broadcast), not the Crowdsource feed
    sentBodyGps: (stop: string) => `Your location shows on the live map until you reach ${stop}.`,
    failedTitle: 'Update not sent',
    failedBody: 'Try again in a moment.',
    noUsername: 'Pick a username in Profile first.',
    openProfile: 'Open Profile',
  },

  topBar: {
    // Shown until the user picks a username
    guest: 'Commuter',
    notifications: 'Notifications',
    energy: (balance: string, refill: string | null) => `${balance} Tracking Energy${refill ? `, refill in ${refill}` : ''}`,
    // ST2-D: the balance in the header, out of the wallet's cap
    energyOf: (balance: string, cap: number) => `${balance}/${cap}`,
    // PRD 14: the server cannot be reached; the offline map, routing and fares keep working
    offline: 'Offline · Live updates paused',
  },

  // The bell in the top bar; notifications come in a later step
  notifications: {
    title: 'Notifications',
    empty: 'No notifications yet',
    emptyBody: 'Arrival alerts and route news will show here.',
  },

  common: {
    ok: 'OK',
    close: 'Close',
    tryAgain: 'Try again',
    back: 'Back',
    skip: 'Skip',
    attribution: '© OpenStreetMap contributors',
    sampleData: 'Sample data',
    // AF2: replaces "Sample data" in the header while simulated live data shows
    demo: 'Demo',
    // A route with only one stored leg (R4, R5): the rest is not traced yet
    partial: 'Partial',
    // RR2: a route whose two legs are not both from Emjay's own files yet
    draft: 'Draft',
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
      // L1: Night Mode (PRD 10.4): the server hides moving multicabs
      night: 'Night Mode',
      // Beside Night Mode on an empty route; beside the count when stopped ones show
      nightHidden: 'Moving ones hidden',
      // Beside No data for a signed-in account not on the team list (live vehicles are team-only in v0)
      teamOnly: 'Team accounts only for now',
    },
    noData: 'No data from riders right now',
    // Age of the freshest position on a Stale route, in whole minutes
    age: (seconds: number) => `${Math.max(1, Math.floor(seconds / SECONDS_PER_MINUTE))} min`,
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
    // Restyle: the Explore card, route selector, active-route card and vehicle card
    explore: {
      title: 'Explore Butuan Transit',
      search: 'Where are you heading today?',
      hint: 'Tap a multicab on the map to see its seats',
      allRoutes: 'All routes',
      minimize: 'Minimize',
      expand: 'Show more',
    },
    selector: {
      title: 'Select route',
      body: 'Choose a multicab line to see it live',
      showOnMap: 'Show on map',
      all: 'All',
      seats: 'Seats available',
      show: (code: string) => `Show ${code} on map`,
      close: 'Close route list',
      open: 'Choose a route',
    },
    active: {
      count: (count: number) => `${count} active`,
      close: 'Hide route',
    },
    vehicle: {
      route: (code: string) => `Route ${code}`,
      next: (stop: string) => `Next: ${stop}`,
      seats: (free: number, taken: number, capacity: number) => `${free} seats available (${taken}/${capacity})`,
      ageSeconds: (seconds: number) => (seconds < SECONDS_PER_MINUTE ? `${Math.max(0, Math.round(seconds))} s ago` : `${Math.floor(seconds / SECONDS_PER_MINUTE)} min ago`),
      liveGps: (age: string) => `Live GPS · ${age}`,
      // PRD 7.4: along the route when the line reaches the commuter, else in a straight line
      fromYou: (distanceKm: number) => `${km(distanceKm)} from you`,
      // PRD 0.7 plug-in point 4: live reports while verification is off
      unverified: 'Prototype data, unverified',
      demo: (age: string) => `Demo · ${age}`,
      stopped: 'Stopped',
      close: 'Close multicab details',
      track: 'Track',
      eta: (text: string) => `~${text}`,
    },
    // L2: tracking one multicab to the commuter's stop
    tracking: {
      minutes: (seconds: number) => (seconds < SECONDS_PER_MINUTE ? '<1 min' : `${Math.round(seconds / SECONDS_PER_MINUTE)} min`),
      // B2: measured along the route, so it can fall while the multicab drives a loop that brings it back
      away: (distanceKm: number) => `${km(distanceKm)} by road`,
      approaching: (stop: string) => `Approaching ${stop}`,
      // No boarding point known: the time shown is to the vehicle's next stop
      toNextStop: (stop: string) => `To next stop ${stop}`,
      // B2: the bar shown on another route, the button that goes back, and the distance alerts
      barTitle: (label: string | null) => (label ? `Tracking ${label}` : 'Tracking a multicab'),
      barDetail: (route: string, eta: string | null) => (eta ? `Route ${route} · ~${eta} · Tap to show` : `Route ${route} · Tap to show`),
      jumpTo: 'Show the multicab you are tracking',
      nearTitle: (distance: string) => `Your multicab is ${distance} away`,
      nearBody: (label: string) => `${label} is on its way to your stop`,
      // B2: tracking ends by itself at the stop
      arrivedTitle: 'Your multicab has arrived',
      arrivedBody: (label: string) => `${label} is at your stop. Tracking has ended.`,
      passed: 'Passed your stop',
      unknown: 'ETA unavailable',
      lastUpdated: 'Last updated',
      departed: 'Departed',
      next: 'Next',
      yourStop: 'Your stop',
      seatsOpen: (free: number) => `${free} seats open`,
      onboard: (taken: number, capacity: number) => `${taken}/${capacity} onboard`,
      alert: 'Alert near arrival',
      alertOn: 'Alert on',
      alertNow: (minutes: string) => `Your multicab is about ${minutes} away`,
      stop: 'Stop tracking',
      you: 'You',
      demoStop: (stop: string) => `Demo: you wait at ${stop}`,
      lost: 'No recent position',
      // SB2: paying for a session
      noEnergyTitle: 'Not enough Energy',
      noEnergyBody: (cost: number, minutes: number) => `Tracking costs ${cost} Energy for ${minutes} minutes. Earn Energy with check-ins and relays.`,
      earnByReporting: 'Relay an update',
      failedTitle: 'Tracking could not start',
    },
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

  // G0: the privacy notice before any location use (PRD 7.1, 15.1). Short English draft; it needs
  // the DPO's review before a pilot, and Cebuano later.
  consent: {
    title: 'Your location',
    intro: 'Tunton can use your location. Read this first; you can change your mind later.',
    sections: [
      { heading: 'What is used', body: "Your phone's position and how precise it is, only while the app is open. Never in the background." },
      {
        heading: 'Why',
        body: 'To show you on the map, start a trip from where you are, confirm you are at a stop when you check in, and mark a report as "with GPS".',
      },
      {
        heading: 'What leaves your phone',
        body: 'Your position is not stored or sent. A check-in sends only the stop, and a report only the nearest stop.',
      },
      {
        heading: 'Your choice',
        body: 'Without it the app still works: long-press the map to set where you start. Withdraw any time in Settings, Privacy.',
      },
    ],
    draft: 'Draft notice, pending review by the Data Protection Officer.',
    agree: 'I agree',
    notNow: 'Not now',
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
    // PRD 15.3: the fare disclaimer under the fare
    fareDisclaimer: 'Does not replace the official fare',
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
    // A route serves both points, but only in a direction that is not traced yet (no Swap)
    notMapped: (code: string) => `${code} · this way isn't mapped yet`,
    // No single route serves both points
    differentRoutes: 'No one route serves both',
    nearFrom: 'From',
    nearTo: 'To',
    moveToRoute: 'Move pin to the route',
    allRoutes: 'All routes',
    mapComingSoon: 'Map coming soon',
    showRoute: (code: string) => `Show route ${code} on the map`,
    routeEnds: (from: string, to: string) => `${from} ↔ ${to}`,
    // Restyle: My Rides as one scrolling page
    start: 'Starting point',
    destination: 'Destination',
    choose: 'Tap the map or pick a stop',
    useMyPosition: 'Use my position',
    currentLocation: 'Current location',
    you: (code: string) => `You (${code})`,
    clearField: (field: string) => `Clear ${field}`,
    distance: 'Distance',
    summary: (rideKm: number, walkM: number) => `${km(rideKm)} ride · ${meters(walkM)} walk`,
    discountChip: (percent: number, label: string) => `${percent}% ${label} fare`,
    regularWas: (amount: number) => `Regular fare ${peso(amount)}`,
    suggested: 'Suggested route',
    bestMatch: 'Best match',
    boardAt: (code: string) => `Board at ${code}`,
    getOffAt: (code: string) => `Get off at ${code}`,
    walkTo: (distanceM: number) => `${meters(distanceM)} walk`,
    viewRouteOnMap: (code: string) => `View ${code} on Map`,
    or: 'or',
    stationsCheckin: 'View stations & check-in',
    checkinNote: 'Let nearby multicabs know you are waiting at the stop',
    fareDetails: 'Fare details',
    otherRoutes: 'Other routes',
    pickStop: 'Pick a stop',
    coming: (count: number, seats: number) => `${count} multicab${count === 1 ? '' : 's'} coming · ${seats} free seats`,
    noneComing: 'No multicab data near your stop',
    recentRides: 'Recent rides',
    recentRide: (code: string) => `Boarded at ${code}`,
    recentFrom: (source: 'checkin' | 'report') => (source === 'checkin' ? 'Check-in' : 'Relay report'),
    ago: (minutes: number) =>
      minutes < 1 ? 'Just now' : minutes < MINUTES_PER_HOUR ? `${minutes} min ago` : minutes < MINUTES_PER_DAY ? `${Math.floor(minutes / MINUTES_PER_HOUR)} h ago` : `${Math.floor(minutes / MINUTES_PER_DAY)} d ago`,
    // ST2-C2: the floating From and To card, and typed search
    expandTrip: (summary: string) => `${summary}. Show From and To`,
    collapseTrip: 'Fold From and To',
    searchPlaceholder: 'Search a stop or place',
    searchField: (field: string) => `Search for ${field}`,
    searchResult: (name: string) => `Choose ${name}`,
    noMatches: 'No stop or place by that name',
    // ST2-C3: the line under a search result: a stop's code, "Your place", or the kind of place and
    // the barangay it is near
    resultDetail: (place: { kind: string; code?: string; category?: string; near?: string }) => {
      if (place.kind === 'saved') return place.code ? `Your place · Stop ${place.code}` : 'Your place';
      if (place.kind === 'stop') return `Stop ${place.code ?? ''}`.trim();
      if (place.kind === 'area') return 'Barangay';
      const what = place.kind === 'street' ? 'Street' : placeKind(place.category ?? '');
      return place.near ? `${what} · near ${place.near}` : what;
    },
    // ST2-C3: the stop dots on the My Rides map
    hideStops: 'Hide stops',
    showStops: 'Show stops',
    // ST2-C: the top line of the results sheet
    finding: 'Finding routes',
    noRoute: 'No route for this trip',
  },

  // Check-in: a local countdown in UX2; the cloud check-in, geofence and reminder arrive in G1
  checkin: {
    pickStation: 'Pick a station',
    // RR1: R3 and R5 have no stations yet
    noStations: 'No stations on this route yet',
    checkIn: 'Check in',
    checkInAt: (code: string) => `Check in at ${code}`,
    // B3: every stop by default, a route filter, the minimised card, the farewell and the reminder
    allRoutes: 'All',
    allHint: 'Tap a station, or pick a route to see only its stops',
    filterLabel: (code: string, on: boolean) => `Show only ${code} stops${on ? ', on' : ''}`,
    allLabel: (on: boolean) => `Show every route's stops${on ? ', on' : ''}`,
    routesHere: 'Routes here',
    minimize: 'Make the card smaller',
    expand: 'Show the whole card',
    compactActive: (code: string) => `Checked in at ${code}`,
    farewellTitle: 'Safe travel!',
    farewellBody: (routes: string) => `Enjoy your ride on ${routes}. Your check-in has ended.`,
    farewellDone: 'Done',
    reminderTitle: (code: string) => `Still waiting at ${code}?`,
    reminderBody: (left: string) => `You are still checked in, ${left} left. Open Check-in to see it.`,
    boarded: 'I boarded',
    cancel: 'Cancel',
    countdown: (time: string) => `${time} left`,
    countdownLabel: (code: string, time: string) => `Checked in at ${code}, ${time} left`,
    // C1
    waiting: (count: number) => (count === 1 ? '1 waiting' : `${count} waiting`),
    notHereTitle: 'Check in at the station',
    tooFar: (distanceM: number, radiusM: number, code: string) =>
      `You are ${distanceM} m from ${code}. Check in within ${radiusM} m of the station.`,
    inaccurate: (gateM: number) => `Your location is not precise enough yet (needs ${gateM} m or better). Wait a moment outdoors and try again.`,
    // G0: a mock location app is on, or the last fix is too old
    mocked: 'Your phone reports a mock location. Turn off any mock location app to check in.',
    stale: 'Your last location is too old. Wait for a fresh fix and try again.',
    noPosition: 'Turn on location to check in. On the emulator, use a simulated stop in Demo & simulation.',
    failedTitle: 'Check-in failed',
    signIn: 'Sign in',
    failedBody: 'Try again in a moment.',
    // C1 UI pass: the sheet, after Google Maps' place sheet
    title: 'Stations & check-in',
    tapHint: 'Tap a station dot on the map',
    stopsCount: (count: number) => (count === 1 ? '1 stop' : `${count} stops`),
    walkMin: (minutes: number) => `${Math.max(1, minutes)} min walk`,
    // A shared stop: which routes' drivers hear about this check-in
    pingRoutes: 'Ping routes',
    pingAll: 'All',
    pingHint: 'Only the routes you pick are notified',
    pingLabel: (code: string, on: boolean) => `${code}, ${on ? 'pinged' : 'not pinged'}`,
    nearest: 'Nearest to you',
    picked: 'Selected station',
    distance: (metres: number) => (metres < METERS_PER_KM ? `${metres} m` : km(metres / METERS_PER_KM)),
    // "RCA · 120 m · 2 waiting"; parts that are unknown are left out
    meta: (parts: readonly string[]) => parts.join(' · '),
    cancelCheckIn: 'Cancel check-in',
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
    demoData: 'Demo data',
    on: 'On',
    off: 'Off',
    demoDataLabel: (on: boolean) => (on ? 'Demo data on' : 'Demo data off'),
    mapLabels: 'Map labels',
    mapLabelsLabel: (on: boolean) => (on ? 'Map labels on' : 'Map labels off'),
    // Restyle: grouped settings page
    transit: 'Transit',
    appearance: 'Appearance',
    privacy: 'Privacy',
    system: 'System',
    defaultRoute: 'Default route',
    defaultRouteNone: 'None',
    seatFilter: 'Seat filter',
    seatFilterBody: 'Show only multicabs with free seats',
    arrivalAlert: 'Arrival alert',
    arrivalAlertBody: 'On when you start tracking',
    darkMode: 'Dark mode',
    mapLabelsBody: 'Street and place names',
    profileOnPhone: 'Profile on this phone',
    profileOnPhoneBody: 'Fare type, avatar and places are never sent',
    localOnly: 'Local only',
    // G0: location consent and withdrawal
    location: 'Location',
    locationOn: 'Agreed · Android allows it',
    locationAgreedOnly: 'Agreed · Android has not allowed it',
    locationNone: 'Not agreed · Tap to read the notice',
    locationWithdrawn: 'Withdrawn · Tap to read the notice',
    withdrawTitle: 'Withdraw location consent?',
    withdrawBody: 'Tunton stops using your location at once. To remove the Android permission as well, open Android settings.',
    withdraw: 'Withdraw',
    androidSettings: 'Android settings',
    // PRD 15.1: a contact point for privacy questions and data requests, and account deletion (D10)
    privacyContact: 'Privacy questions',
    privacyContactBody: (email: string) => `Email ${email}`,
    requestData: 'Request my data',
    requestDataBody: 'Ask for a copy of what the server holds',
    requestDataSubject: 'Tunton data request',
    privacyContactSubject: 'Tunton privacy question',
    mailFailedTitle: 'No email app',
    mailFailedBody: (email: string) => `Write to ${email} from any email app.`,
    deleteAccount: 'Delete account',
    deleteAccountBody: 'Removes your account and clears this phone',
    deleteAccountLocalBody: 'Clears everything on this phone',
    deleteTitle: 'Delete your account?',
    deleteBody:
      'Your account, username, check-ins, relays, flags and Energy are removed from the server, and this phone is cleared. This cannot be undone.',
    deleteLocalBody: 'You are not signed in, so only this phone is cleared: profile, places, rides and settings. This cannot be undone.',
    deleteConfirm: 'Delete',
    deleting: 'Deleting…',
    deleteFailedTitle: 'Account not deleted',
    deleteFailedBody: 'Nothing was removed. Check your connection and try again.',
    deletedTitle: 'Account deleted',
    language: 'Language',
    english: 'English',
    offlineMap: 'Offline map',
    offlineMapBody: 'Butuan City, built into the app',
    bundled: 'Built in',
    // ST2-D
    replayTour: 'Replay tips tour',
    replayTourBody: 'The bubbles that point out each button on the Map',
    licences: 'Licences',
  },

  // The burger menu in the top bar (restyle)
  menu: {
    title: 'Menu',
    open: 'Open menu',
    profile: 'Profile',
    settings: 'Settings & preferences',
    demo: 'Demo & simulation',
    about: 'About Tunton',
    replayIntro: 'Replay introduction',
    signIn: 'Sign in or create account',
    signOut: 'Sign out',
    signedInAs: (email: string) => `Signed in as ${email}`,
    guest: 'Not signed in',
  },

  // Demo & simulation: what the emulator cannot do by itself; also works on a phone
  demo: {
    title: 'Demo & simulation',
    simulation: 'Simulation',
    demoVehicles: 'Simulated multicabs',
    demoVehiclesBody: 'Moving demo multicabs on every route, labelled "Demo"',
    simulatedLocation: 'Simulated location',
    simulatedLocationBody: 'Stand at a stop instead of using GPS',
    standAt: 'Stand at',
    standAtBody: 'Your position while simulated location or fake GPS is on',
    // G0: the development fake location source
    fakeGps: 'Fake GPS (development)',
    fakeGpsBody: 'GPS fixes at the stop below, through consent and the accuracy gates',
    fakeAccuracy: 'Accuracy',
    fakeAccuracyM: (metres: number) => `${metres} m`,
    fakeMocked: 'Mocked',
    fakeMockedBody: 'Marked as a mock location',
    fakeStale: 'Stale',
    fakeStaleBody: (seconds: number) => `${seconds} seconds old`,
    reset: 'Reset',
    resetApp: 'Reset app',
    resetAppBody: 'Clears everything on this phone and starts again',
    resetConfirmTitle: 'Reset the app?',
    resetConfirmBody: 'Your profile, settings, recent rides and sign-in on this phone are cleared.',
    resetConfirm: 'Reset',
    cancel: 'Cancel',
  },

  // Profile page (restyle): who you are in the app, and what stays on the phone
  profilePage: {
    title: 'Profile',
    handle: 'Username',
    noHandle: 'No username yet',
    fareType: 'Fare type',
    change: 'Change',
    // B7: the compact profile header
    fareTypeLabel: (current: string) => `Fare type, ${current}. Change`,
    changeAvatar: 'Change avatar',
    pickAvatar: 'Pick an avatar',
    editHandle: 'Edit username',
    saveHandle: 'Save username',
    cancelHandle: 'Cancel editing',
    trusted: 'Trusted commuter',
    trustedAvatar: 'Your avatar, Trusted commuter',
    trustProgress: (points: number, needed: number) => `${Math.min(points, needed)} of ${needed} toward Trusted (check-ins and relays)`,
    trustSignIn: 'Sign in to earn the Trusted badge',
    energyOf: (balance: string, cap: number) => `${balance} / ${cap}`,
    history: (count: number) => (count > 0 ? `General history (${count})` : 'General history'),
    historyEmpty: (hours: number) => `Nothing yet. Check-ins, relays, rides and Energy show here; a refill comes every ${hours} hours.`,
    // D1: while Energy is hidden
    historyEmptyNoEnergy: 'Nothing yet. Check-ins, relays and rides show here.',
    historyRide: (code: string, station: string) => `Boarded ${code} at ${station}`,
    clearHistory: 'Clear history',
    clearTitle: 'Clear your history?',
    clearBody: 'It is cleared on this phone only. Your Energy and ride counts stay as they are.',
    clearBodyNoEnergy: 'It is cleared on this phone only. Your ride counts stay as they are.',
    clearConfirm: 'Clear',
    stats: 'Your rides',
    rides: 'Rides',
    checkins: 'Check-ins',
    reports: 'Relays',
    energy: 'Tracking Energy',
    energyFree: 'Free during the pilot',
    // SB2
    // The passive refill countdown: "11h 59m" or "59m"
    refillIn: (hours: number, minutes: number) => (hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`),
    energyRefill: (time: string) => `Refill in ${time}`,
    energyFull: 'Full',
    energySignIn: 'Sign in to earn Energy',
    energyKinds: {
      gps_report: 'Report with GPS',
      no_gps_report: 'Report without GPS',
      checkin: 'Check-in',
      passive: 'Refill',
      tracking: 'Tracked a multicab',
    } as Record<'gps_report' | 'no_gps_report' | 'checkin' | 'passive' | 'tracking', string>,
    energyAmount: (amount: number) => `${amount > 0 ? '+' : '−'}${Math.abs(amount).toFixed(1)}`,
    handleNotSaved: 'Not saved to your account yet',
    handleTaken: 'Someone already has this username. Pick another.',
    handleSaveFailed: 'Could not save the username. It will be sent again when you sign in.',
  },

  loading: {
    routeData: 'Loading route data',
    routeDataFailed: 'The route data could not be loaded.',
    tiles: 'Preparing the offline map',
    tilesFailed: 'The offline map could not be set up.',
  },

  map: {
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
    title: 'Sign in',
    createTitle: 'Create account',
    email: 'Email',
    password: 'Password',
    newPassword: (min: number) => `Password (at least ${min} characters)`,
    // ST2-A
    confirmPassword: 'Confirm password',
    mismatch: 'The passwords do not match.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    forgot: 'Forgot your password?',
    forgotNeedsEmail: 'Enter your email above first.',
    resetSent: 'If that email has an account, a reset link is on its way.',
    submit: 'Sign in',
    create: 'Create account',
    submitting: 'Please wait',
    toCreate: 'New here? Create an account',
    toSignIn: 'Have an account? Sign in',
    checkEmail: 'Check your email and open the link, then sign in.',
    cancel: 'Cancel',
  },

  // ST2-D: what a guest sees on a control that needs an account
  guest: {
    title: 'Account needed',
    body: 'Please sign in or create an account to use this feature.',
    signIn: 'Sign in',
    notNow: 'Not now',
    locked: (feature: string) => `${feature}, needs an account`,
  },

  // ST2-D: the tips tour, one bubble per control on the Map tab
  tour: {
    steps: {
      profile: { title: 'Your profile', body: 'Your avatar, username and fare type. Tap it for your badges.' },
      menu: { title: 'Menu', body: 'Settings, your places, and this tour again.' },
      relay: { title: 'Relay a multicab', body: 'On a multicab? Tell others if it has seats, is full or stuck in traffic.' },
      routes: { title: 'Routes', body: 'Pick a route to see its line, stops and multicabs.' },
      locate: { title: 'Where you are', body: 'Puts the map on you.' },
      search: { title: 'Plan a trip', body: 'Type where you are going for the best route and the fare.' },
      checkin: { title: 'Check in', body: 'Waiting at a stop? Check in so drivers know someone is there.' },
      ride: { title: 'My Rides', body: 'From, To, the fare and the routes that take you there.' },
      crowdsource: { title: 'Crowdsource', body: 'What other commuters reported in the last hour.' },
    } satisfies Record<TourStepId, { title: string; body: string }>,
    count: (step: number, total: number) => `${step}/${total}`,
    next: 'Next',
    finish: "Let's ride!",
    skip: 'Skip',
    skipLabel: 'Skip the tips tour',
    done: "Tour done. You're ready to ride!",
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
    checkin: 'Tap a station to check in',
    ride: 'Where are you going?',
    dismiss: 'Dismiss tip',
  },

  // F5: badges from the user's own counts (D8); no ranking
  badges: {
    title: (earned: number, total: number) => `Trust Badges (${earned}/${total})`,
    names: {
      first_trip: 'First trip planned',
      first_checkin: 'First check-in',
      stop_regular: 'Regular at the stop',
      first_report: 'First relay',
      helping_hand: 'Helping hand',
      road_regular: 'Road regular',
      first_live_report: 'First live relay',
    },
    hints: {
      first_trip: 'Plan a trip in My Rides',
      first_checkin: 'Check in at a station',
      stop_regular: 'Check in 5 times',
      first_report: 'Relay a multicab update',
      helping_hand: 'Relay 5 updates',
      road_regular: 'Relay 20 updates',
      first_live_report: 'Relay with GPS shared',
    },
    progress: (have: number, need: number) => `${have}/${need}`,
    done: 'Earned',
    earned: (name: string) => `Badge earned: ${name}`,
    earnedLabel: (name: string) => `${name}, earned`,
    progressLabel: (name: string, have: number, need: number) => `${name}, ${have} of ${need}`,
    note: 'Counted on this phone. No ranking, nothing compared with others.',
  },

  // F3: frequent destinations and the routes that serve them
  places: {
    title: (count: number, max: number) => `Your places (${count}/${max})`,
    empty: 'Save a place with the star on To in My Rides.',
    routes: (codes: string[]) => (codes.length > 0 ? `Routes: ${codes.join(', ')}` : 'No route within a walk'),
    remove: (label: string) => `Remove ${label}`,
    save: 'Save as one of your places',
    saved: (label: string) => `${label} saved to your places`,
    // ST2-C2: the star tapped again
    removed: (label: string) => `${label} removed from your places`,
    already: 'Already one of your places',
    full: (max: number) => `You have ${max} places. Remove one in Profile.`,
  },

  greeting: {
    planRide: 'Plan a ride',
    // F3: a destination chip with the routes that serve it
    via: (label: string, codes: string[]) => (codes.length > 0 ? `${label} · ${codes.join(', ')}` : label),
    goTo: (name: string) => `Plan a ride to ${name}`,
    hide: 'Hide greeting',
  },

  onboarding: {
    step: (current: number, total: number) => `Step ${current} of ${total}`,
    next: 'Continue',
    finish: 'Finish setup',
    welcomeTitle: 'Commute smarter in Butuan',
    welcomeBody: 'Live multicab locations and fares.',
    features: {
      live: 'Live multicab locations and seats',
      offline: 'Map, routes and fares work offline',
      privacy: 'Private and battery-friendly',
    },
    signIn: 'Sign in or create account',
    withoutAccount: 'Continue without an account',
    welcomeNote: 'No phone number needed · You can sign in later',
    profileStep: 'Profile',
    profileTitle: 'Choose your profile',
    profileBody: 'Pick an avatar and a username.',
    persona: 'Your avatar',
    handle: 'Username',
    handlePlaceholder: 'e.g. JuanCommuter',
    handleHint: (min: number, max: number) => `${min} to ${max} letters, digits or _. Shown on your reports instead of your name.`,
    handleInvalid: (min: number, max: number) => `Use ${min} to ${max} letters, digits or _`,
    handleBlocked: 'This username is not allowed. Pick another.',
    // ST2-B
    suggestUsername: 'Suggest another username',
    swipeAvatars: 'Swipe for more',
    typeStep: 'Fare',
    typeTitle: 'Select commuter type',
    typeBody: 'Applies the fare discount to your estimates.',
    typeSubtitles: {
      regular: 'Standard fare',
      student: 'With a valid school ID',
      senior: '60 years and older',
      pwd: 'With a PWD ID',
    } satisfies Record<Classification, string>,
    discount: (percent: number) => `${percent}% off`,
    placesStep: 'Places',
    placesTitle: 'Where do you usually go?',
    placesBody: (max: number) => `Pick up to ${max}. They show up first in My Ride.`,
    placesSearch: 'Search places',
    placesNone: 'No place matches',
    placeLabel: (name: string) => `Frequent destination ${name}`,
    // F3: each landmark with the routes that serve it
    // ST2-B: the full name is the title; the short code and route badges sit under it
    showMorePlaces: (count: number) => `Show ${count} more`,
    showFewerPlaces: 'Show fewer',
    permissionsStep: 'Permissions',
    permissionsTitle: 'App permissions',
    permissionsBody: 'Turn on what you want now; you can change it later in Android Settings.',
    permissions: {
      location: {
        title: 'Location',
        body: 'Shows you on the map and the multicabs coming to you. Only while the app is open; never stored with your identity.',
        status: 'When used',
        allowed: 'Allowed',
        blocked: 'Open Settings',
      },
      nearby: { title: 'Nearby multicab detection', body: 'Finds the multicab you board', status: 'Coming later' },
      alerts: { title: 'Arrival alerts', body: 'Tells you before your stop', status: 'Coming later' },
    },
    permissionsNote: 'Your location is never shared with your identity.',
  },

  about: {
    title: 'About',
    version: (version: string) => `Version ${version}`,
    sampleData: 'Sample route data, not official',
    // LB1a: the bundled label fonts (licence text in assets/glyphs/glyphs-v1/OFL.txt)
    fontCredit: 'Map labels use Noto Sans, SIL Open Font License 1.1',
    licences: 'Licences',
    staysOnPhone: 'Your profile choices stay on your phone',
  },

  // About → Licences (LB1): the map data credit and the full font licence
  licences: {
    title: 'Licences',
    mapTitle: 'Map data',
    mapNote:
      'Map data from OpenStreetMap, available under the Open Database License (ODbL). The offline map is built with Protomaps from OpenStreetMap and Natural Earth.',
    fontTitle: 'Noto Sans (map labels)',
    fontCopyright: 'Copyright 2022 The Noto Project Authors',
  },

  dev: {
    overlay: (install: string, mapStatus: string) => `DEV  tiles: ${install}  map: ${mapStatus}`,
    camera: (zoom: number, lon: number, lat: number) =>
      `zoom ${zoom.toFixed(2)}  centre ${lon.toFixed(4)}, ${lat.toFixed(4)}`,
    cameraIdle: 'camera not moved yet',
  },
};

export type Strings = typeof en;

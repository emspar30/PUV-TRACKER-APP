// Every piece of text the commuter sees, in one place.
// To add Cebuano later: copy this file to ceb.ts, translate the values, and switch the export
// in src/strings/index.ts. No translation library is needed for that.

import type { Classification } from '@/shared/config';
import type { GreetingPeriod } from '@/shared/profile/greeting';
import type { PlanFailure } from '@/shared/routing/plan';
import type { SnapName } from '@/shared/ui/sheetSnap';

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
    unverified: 'Relays show as unverified for now.',
    send: 'Relay update',
    sending: 'Sending…',
    sentTitle: 'Update relayed',
    sentBody: (minutes: number) => `It shows in Crowdsource for ${minutes} minutes.`,
    // With GPS the update belongs to the live map (broadcast), not the Crowdsource feed
    sentBodyGps: (stop: string) => `Your location shows on the live map until you reach ${stop}.`,
    failedTitle: 'Update not sent',
    failedBody: 'Try again in a moment.',
    noUsername: 'Pick a handle in Profile first.',
    openProfile: 'Open Profile',
  },

  topBar: {
    // Shown until the user picks a handle
    guest: 'Commuter',
    notifications: 'Notifications',
    energy: (balance: string, refill: string | null) => `${balance} Tracking Energy${refill ? `, refill in ${refill}` : ''}`,
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
    expandMap: 'Make the map bigger',
    shrinkMap: 'Make the map smaller',
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
    language: 'Language',
    english: 'English',
    offlineMap: 'Offline map',
    offlineMapBody: 'Butuan City, built into the app',
    bundled: 'Built in',
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
    standAtBody: 'Your position while simulated location is on',
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
    handle: 'Handle',
    noHandle: 'No handle yet',
    fareType: 'Fare type',
    change: 'Change',
    // B7: the compact profile header
    fareTypeLabel: (current: string) => `Fare type, ${current}. Change`,
    changeAvatar: 'Change avatar',
    pickAvatar: 'Pick an avatar',
    editHandle: 'Edit handle',
    saveHandle: 'Save handle',
    cancelHandle: 'Cancel editing',
    trusted: 'Trusted commuter',
    trustedAvatar: 'Your avatar, Trusted commuter',
    trustProgress: (points: number, needed: number) => `${Math.min(points, needed)} of ${needed} toward Trusted (check-ins and relays)`,
    trustSignIn: 'Sign in to earn the Trusted badge',
    stats: 'Your rides',
    rides: 'Rides',
    checkins: 'Check-ins',
    reports: 'Reports',
    storage: 'Storage',
    locationHistory: 'Location history',
    none: 'None kept',
    energy: 'Tracking Energy',
    energyFree: 'Free during the pilot',
    // SB2
    energyBalance: (balance: string, cap: number) => `${balance} (max ${cap})`,
    // The passive refill countdown: "11h 59m" or "59m"
    refillIn: (hours: number, minutes: number) => (hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`),
    energyRefill: (time: string) => `Refill in ${time}`,
    energyFull: 'Full',
    energySignIn: 'Sign in to earn Energy',
    energyHistory: 'Energy history',
    energyEmpty: (hours: number) => `No Energy yet. A refill comes every ${hours} hours.`,
    energyKinds: {
      gps_report: 'Report with GPS',
      no_gps_report: 'Report without GPS',
      checkin: 'Check-in',
      passive: 'Refill',
      tracking: 'Tracked a multicab',
    } as Record<'gps_report' | 'no_gps_report' | 'checkin' | 'passive' | 'tracking', string>,
    energyAmount: (amount: number) => `${amount > 0 ? '+' : '−'}${Math.abs(amount).toFixed(1)}`,
    handleNotSaved: 'Not saved to your account yet',
    handleTaken: 'Someone already has this handle. Pick another.',
    handleSaveFailed: 'Could not save the handle. It will be sent again when you sign in.',
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
    note: 'Live multicabs, check-in counts and reports need an account. The map, routes and fares work without one.',
    createTitle: 'Create account',
    createNote: 'Only your email and a password. Your handle shows on reports instead of your name.',
    email: 'Email',
    password: 'Password',
    newPassword: (min: number) => `Password (at least ${min} characters)`,
    submit: 'Sign in',
    create: 'Create account',
    submitting: 'Please wait',
    toCreate: 'New here? Create an account',
    toSignIn: 'Have an account? Sign in',
    checkEmail: 'Check your email and open the link, then sign in.',
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
    checkin: 'Tap a station to check in',
    ride: 'Where are you going?',
    dismiss: 'Dismiss tip',
  },

  greeting: {
    planRide: 'Plan a ride',
    goTo: (name: string) => `Plan a ride to ${name}`,
    hide: 'Hide greeting',
  },

  onboarding: {
    savedOnPhone: 'Saved on your phone only',
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
    profileBody: 'Pick an avatar and a handle.',
    persona: 'Your avatar',
    personaCount: (count: number) => `${count} styles`,
    handle: 'Handle',
    handlePlaceholder: 'e.g. JuanCommuter',
    handleHint: (min: number, max: number) => `${min} to ${max} letters, digits or _. Shown on your reports instead of your name.`,
    handleInvalid: (min: number, max: number) => `Use ${min} to ${max} letters, digits or _`,
    handleBlocked: 'This handle is not allowed. Pick another.',
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

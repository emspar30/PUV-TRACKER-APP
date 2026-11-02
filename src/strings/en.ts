// Every piece of text the commuter sees, in one place.
// To add Cebuano later: copy this file to ceb.ts, translate the values, and switch the export
// in src/strings/index.ts. No translation library is needed for that.

import type { Classification, FlagTag } from '@/shared/config';
import type { GreetingPeriod } from '@/shared/profile/greeting';
import type { PlanFailure } from '@/shared/routing/plan';
import type { SnapName } from '@/shared/ui/sheetSnap';
import type { TourStepId } from '@/shared/ui/tourPlacement';
import type { Strike, StrikeReason } from '@/shared/moderation/rules';

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
    mapNear: 'Map, your tracked multicab is near',
    // The middle button: opens the Relay form over the current tab
    relay: 'Relay',
    ride: 'My Rides',
    crowdsource: 'Crowdsource',
  },

  // Crowdsource tab (restyle; the real feed and the Report button come with N1 and RP1)
  crowdsource: {
    title: 'Crowdsource',
    body: 'Reports from commuters in the last hour',
    // The user's own posts on live data come from the database (N1 reads the same table)
    signIn: 'Sign in to see live reports',
    // PRD 14: the feed could not load because the server cannot be reached
    offline: 'You are offline. Reports show again when you are back online.',
    // N1: flagging someone else's post
    flag: 'Flag report',
    flagLabel: (username: string) => `Flag the report by ${username}`,
    flagTitle: 'Flag this report?',
    flagBody: (count: number) => `Flag reports that are wrong or abusive. After ${count} flags a report is hidden and reviewed.`,
    flagConfirm: 'Flag',
    flagCancel: 'Cancel',
    flaggedTitle: 'Thanks for flagging',
    flaggedBody: 'The report is hidden for you.',
    // MOD1b: what is wrong with the report
    flagTags: {
      false_location: 'Wrong location',
      spamming: 'Spam',
      not_a_puv: 'Not a multicab',
    } satisfies Record<FlagTag, string>,
    flagWhy: 'What is wrong with it?',
    flagTooNew: 'New accounts can flag after 7 days, or once you have the Trusted badge.',
    flagLimit: 'You have flagged many reports today. Try again tomorrow.',
    flagFailedTitle: 'Flag not sent',
    flagFailedBody: 'Try again in a moment.',
    you: 'You',
    // B6: the compact card
    noVehicle: 'Multicab',
    trusted: 'Trusted',
    // V1a: the relay passed the verification window
    verified: 'Verified ride',
    verifiedLabel: 'Verified ride: the multicab moved along its route with the rider',
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
    whatsHappening: "What's happening? (optional)",
    seats: 'Seats',
    // B4: the destination ends the relay (RL2a: required); Bluetooth fills in the vehicle
    destination: 'Destination',
    destinationHint: 'Where you get off. Your relay ends there.',
    destinationNone: 'No stops on this route yet, so it cannot be relayed.',
    bleTitle: 'Found by Bluetooth',
    bleBody: 'Route and multicab filled in',
    bleLabel: (code: string, plate: string) => `Found by Bluetooth: ${code}, ${plate}`,
    // RL2a polish: demo data has no beacons; a moving demo multicab close by counts as heard
    demoVehicleTitle: 'Demo multicab',
    demoVehicleBody: 'Found nearby (demo data only)',
    demoVehicleLabel: (code: string, plate: string) => `Demo multicab: ${code}, ${plate}`,
    // RL2a (Emjay's D9, D10): why the form is greyed out
    gate: {
      needsPermission: "Relay needs your location, to check you are on the multicab's route.",
      locationOff: "Your phone's location is off. Relay needs it.",
      turnOn: 'Turn on location',
      openSettings: 'Open settings',
      waitingFix: 'Waiting for your location…',
      noBluetooth: 'Relay needs Bluetooth to find the multicab you are in.',
      noBeacon: 'No registered multicab detected. This multicab may not be registered with Tunton.',
      several: 'More than one multicab is near. Sit inside yours and wait a moment.',
      noDemoBeacon: (m: number) => `Demo: no demo multicab within ${m} m. Wait on its route until one passes.`,
      offRoute: (code: string) => `You are not on Route ${code}'s route.`,
    },
    // DR8: the Nearby devices explainer (PRD 4.2) and the Bluetooth card's other states
    nearby: {
      title: 'Find your multicab by Bluetooth',
      body: "Inside a multicab, Tunton can hear its signal and fill in the route and plate for you. It listens only for multicab signals, and only while this panel is open. Nothing is stored.",
      continue: 'Continue',
      notNow: 'Not now',
      useBluetooth: 'Find my multicab by Bluetooth',
      blocked: 'Nearby devices is off for Tunton. Allow it in Settings to find your multicab by Bluetooth.',
      openSettings: 'Open settings',
      needsLocation: 'To find your multicab by Bluetooth, allow location first (Locate me on the map).',
      locationOff: "Turn on your phone's location to find your multicab by Bluetooth.",
    },
    ble: {
      searching: 'Looking for the multicab you are in…',
      ambiguous: 'More than one multicab nearby.',
      bluetooth_off: 'Bluetooth is off. Turn it on to find your multicab.',
      no_permission: 'Nearby devices is off for Tunton.',
      not_supported: 'This phone cannot look for multicabs, so it cannot relay.',
      stopped: 'Stopped looking for your multicab. Close and open Relay to look again.',
      beacon_invalid: "This multicab's signal did not check out.",
      beacon_expired: "This multicab's signal is out of date.",
      unknown_vehicle: 'This multicab is not registered with Tunton.',
      too_many_checks: 'Too many checks for now. Wait a moment.',
      network: 'Could not check the multicab (no connection).',
      sign_in: 'Sign in to find your multicab by Bluetooth.',
    },
    sharingTitle: 'Sharing your location',
    // RL2a: a Crowdsource relay sends no location
    feedTitle: 'Relayed in Crowdsource',
    lapsedTitle: 'Relay ended',
    lapsedBody: 'Your relay is no longer in Crowdsource.',
    sharingDetail: (code: string, stop: string) => `${code} · until ${stop}`,
    stopSharing: 'Stop',
    // CA1.1: the relay's details, opened from the bar
    info: {
      show: 'Show relay details',
      hide: 'Hide relay details',
      left: (distance: string, stop: string) => `${distance} to ${stop}`,
      doneLabel: 'Ride done so far',
      toGo: (distance: string, byRoad: boolean, minutes: number | null) =>
        `${distance} ${byRoad ? 'by road ' : ''}to go${minutes !== null ? `, about ${minutes} min at this speed` : ''}.`,
      noPosition: 'Waiting for your location to measure how far is left.',
      route: (code: string, stop: string) => `${code}, getting off at ${stop}.`,
      multicab: (vehicle: string | null, seats: string) => `${vehicle ? `Multicab ${vehicle}` : 'No multicab picked'} · ${seats}.`,
      shared: (minutes: number, askIn: number) => `Shared for ${minutes} min. It stops at your stop; in ${askIn} min it asks if you are still riding.`,
    },
    // T1: what the relay bar says about the marker
    uplink: {
      // BT1: another rider leads this multicab's marker; this phone is backup and takes over if they stop
      backup: "Another rider is sharing this multicab; you're backup.",
      primary: "You're sharing for this multicab.",
      noVehicle: 'No multicab picked, so no live marker',
      // RL2a: a Crowdsource relay
      feed: 'No location is sent · ends at your stop',
      offTeam: 'Live markers are for team accounts for now',
      waiting: 'Waiting for a precise location…',
      live: (seconds: number) => `On the live map · sent ${seconds} s ago`,
      saved: (count: number) => `${count} ${count === 1 ? 'position' : 'positions'} saved · sending when online`,
    },
    // Emjay, 2026-11-02: before the arrival countdown, once per relay
    getOffSoonTitle: 'Get ready to get off',
    getOffSoonBody: (stop: string, metres: number) => `${stop} is about ${metres} m ahead.`,
    arrivedTitle: (stop: string) => `You reached ${stop}`,
    arrivedBody: 'Location sharing stopped. Thanks for the relay!',
    // RL1: the arrival countdown in the relay bar, and the other ways sharing ends by itself
    arriving: (stop: string, seconds: number) => `At ${stop} · sharing stops in ${seconds} s`,
    idleTitle: 'Location sharing stopped',
    idleBody: (minutes: number) => `You stayed in one place for ${minutes} min. Relay again if you are still riding.`,
    stillRidingTitle: 'Still riding?',
    stillRidingBody: (hours: number, minutes: number) =>
      `You have shared your location for ${hours} hours. Keep sharing, or it stops in ${minutes} min.`,
    keepSharing: 'Keep sharing',
    cappedTitle: 'Location sharing ended',
    cappedBody: 'No answer to "Still riding?". Relay again if you are still riding.',
    // RL2a (Emjay's D9): one switch, off by default and remembered
    liveMap: 'Show me on the live map',
    // RL2b: every relay earns, the live map more
    liveMapEarns: (amount: number) => `Your multicab moves on the live map until your stop. Earns +${amount.toFixed(1)} Energy.`,
    feedEarns: (amount: number) => `Off: your relay shows in Crowdsource until your stop. No location is sent. Earns +${amount.toFixed(1)} Energy.`,
    // B1 (PRD 8.5): the relay keeps going while the rider uses other apps
    background: {
      notificationTitle: (route: string) => `Sharing your ride on ${route}`,
      notificationBody: 'Tunton keeps your relay going until your stop. Open Tunton to stop it.',
      askTitle: 'Keep your relay going in other apps?',
      askBody:
        'To keep relaying while you use other apps or the screen is off, Tunton needs location "Allow all the time". It is used only while a relay is queued or running, with a notification. Otherwise the relay pauses when you leave Tunton.',
      askAllow: 'Allow in Settings',
      askLater: 'Not now',
      stoppedTitle: 'Your phone stopped Tunton',
      stoppedBody: 'Your relay paused while Tunton was in the background. To keep it running, let Tunton run in the background:',
      vendorSteps: [
        'Samsung: Settings, Apps, Tunton, Battery, Unrestricted.',
        'Xiaomi or Redmi: Settings, Apps, Tunton, Battery saver, No restrictions; and turn on Autostart.',
        'Oppo or Realme: Settings, Battery, Tunton, Allow background activity.',
        'Vivo: Settings, Battery, Background power consumption, Tunton, Allow.',
        'Infinix or Tecno: Phone Master, App launch management, Tunton, Manage manually, all on.',
      ],
    },
    // RL2c (D12): a relay waits on the phone until the multicab moves with the rider in it
    queue: {
      queuedTitle: 'Relay queued',
      queuedBody: (destination: string) =>
        `It is sent once your multicab moves off with you in it, then it shares your ride until ${destination}. Stay close to the multicab.`,
      barTitle: 'Relay queued',
      barBody: (route: string, destination: string) => `Waiting for the multicab to move · ${route} to ${destination}`,
      cancel: 'Cancel',
      cancelLabel: 'Cancel the queued relay',
      releasedTitle: (plate: string) => `Relay sent: ${plate}`,
      endedTitle: 'Relay not sent',
      ended: {
        walked_away: (seconds: number) => `No multicab was heard for ${seconds} seconds, so you seem to have left it. Nothing was sent.`,
        location_off: () => 'Your location went off. Nothing was sent.',
        timed_out: (minutes: number) => `The multicab did not leave within ${minutes} minutes. Nothing was sent.`,
        other_route: () => 'The multicab that left is on another route. Nothing was sent.',
        same_vehicle: (hours: number) => `You already relayed this multicab in the last ${hours} hours. Nothing was sent.`,
      },
    },
    // RL2b: the same multicab within RELAY_SAME_VEHICLE_GAP_H
    sameVehicle: 'You already relayed this multicab.',
    sameVehicleBody: (hours: number) => `You can relay the same multicab once every ${hours} hours. Another multicab earns as usual.`,
    // D1: while Energy is hidden (tracking is free), the same line without the reward
    liveMapShares: 'Your multicab moves on the live map until your stop.',
    // PRD 10.4: Night Mode publishes passed stops, not moving markers
    liveMapNight: 'Night Mode (9 PM to 5 AM): your multicab shows as the stops it passed, not as a moving marker.',
    feedOnly: 'Off: your relay shows in Crowdsource until your stop. No location is sent.',
    liveMapTeamOnly: 'The live map is open to team accounts only for now. Your relay goes to Crowdsource.',
    unverified: 'Your relay is checked once the multicab moves; it shows as verified after.',
    // V1a: the verification window of a running relay (RelayBar, toasts)
    verify: {
      pending: 'Checking your ride…',
      // DT1: the ride follows an active detour line
      onDetour: 'On a detour: the route is diverted for now',
      verified: 'Verified ride',
      failed: 'Not verified',
      verifiedTitle: 'Ride verified',
      verifiedBody: 'The multicab moved along its route with you. Your relay now shows as verified.',
      failedTitle: 'Ride not verified',
      failedBody: (reason: string) => `${reason} Your relay goes on, marked unverified.`,
      reasons: {
        off_route: 'You seem to be off the route line.',
        no_motion: 'The multicab did not move at riding speed.',
        no_displacement: 'The multicab did not move far enough along its route.',
        no_beacon: "The multicab's Bluetooth signal was not verified.",
        too_few_fixes: 'Your location did not update enough.',
      },
    },
    send: 'Relay update',
    sending: 'Sending…',
    sentTitle: 'Update relayed',
    // RL2a: in Crowdsource until the stop; on the live map the update belongs to the map, not the feed
    sentBodyFeed: (stop: string) => `It shows in Crowdsource until you reach ${stop}.`,
    sentBodyGps: (stop: string) => `Your location shows on the live map until you reach ${stop}.`,
    // PRD 14: shown at the top of the Relay panel while the server cannot be reached
    offline: 'You are offline. A relay is sent over the internet, so it cannot be sent until you are back online.',
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

  // PRD 14: toasts when the server stops or starts answering (useConnectionProbe)
  connection: {
    lostTitle: 'You are offline',
    lostBody: 'The map, routes and fares still work. Live updates pause until you are back online.',
    backTitle: 'Back online',
  },

  // The bell in the top bar; notifications come in a later step
  notifications: {
    title: 'Notifications',
    empty: 'No notifications yet',
    emptyBody: 'Arrival alerts, check-in and relay updates, and new badges will show here.',
    clear: 'Clear all',
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
      // NM1 (PRD 10.4): the Night Mode stop view, instead of moving markers
      nightStopsTitle: (code: string) => `Where ${code} has been`,
      nightStopsEmpty: (code: string) => `No ${code} multicab passed a stop in the last hour.`,
      nightPassed: (stop: string, minutes: number) => (minutes <= 1 ? `Passed ${stop} · 1 min ago` : `Passed ${stop} · ${minutes} min ago`),
      nightStopsNote: 'At night we show stops a multicab passed, a few minutes late, not where it is now.',
      // Beside No data for a signed-in account not on the team list (live vehicles are team-only in v0)
      teamOnly: 'Team accounts only for now',
    },
    noData: 'No data from commuters right now',
    // CA1.1: the Map's zoom buttons
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    // CF1: on a route with no Live vehicle (not at night, not for accounts off the team list)
    nudge: {
      title: (code: string) => `No live data for ${code}`,
      body: 'Riding this route? Share your seats to help others!',
      share: 'Share your seats',
      // Another route that shares a stop with this one has a Live multicab nearby; tapping shows it
      alternative: (code: string, distanceM: number) =>
        `${code} is running nearby · ${distanceM < METERS_PER_KM ? `${distanceM} m` : km(distanceM / METERS_PER_KM)}`,
      alternativeLabel: (code: string) => `Show ${code}, which has a live multicab nearby`,
    },
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
      // CA1.1: the first choice, the default
      allRoutes: 'All routes',
      allRoutesBody: 'Every running multicab on the map',
    },
    active: {
      count: (count: number) => `${count} active`,
      change: 'Change route',
      collapse: 'Back to all routes',
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
      // CF1: a vehicle silent 90 s to 5 minutes, drawn where it probably is (no ETA)
      estimatedSuffix: ' · Estimated',
      estimated: 'Estimated position, moved at its last speed',
      demo: (age: string) => `Demo · ${age}`,
      stopped: 'Stopped',
      // VS1: from a recent relay about this multicab
      loading: 'Loading passengers',
      traffic: 'Heavy traffic',
      close: 'Close multicab details',
      track: 'Track',
    },
    // L2: tracking one multicab to the commuter's stop
    tracking: {
      minutes: (seconds: number) => (seconds < SECONDS_PER_MINUTE ? '<1 min' : `${Math.round(seconds / SECONDS_PER_MINUTE)} min`),
      // B2: measured along the route, so it can fall while the multicab drives a loop that brings it back
      away: (distanceKm: number) => `${km(distanceKm)} by road`,
      awayTo: (distanceKm: number, stop: string) => `${km(distanceKm)} by road to ${stop}`,
      // CF1: the tracked multicab has sent nothing for a while; its marker is Estimated
      signalLost: 'Signal lost · position estimated',
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
      // Gone past the commuter on a loop: the time and distance are to its next time round
      passedYou: 'Passed you · next time round',
      unknown: 'ETA unavailable',
      // PRD 19.4: no time is shown past this distance
      tooFar: (maxKm: number) => `Over ${maxKm} km away`,
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
      // Under the greyed-out Track button, without the phone's location (and no simulated one)
      turnOnToTrack: 'Turn on location to track',
      // SB2: paying for a session
      noEnergyTitle: 'Not enough Energy',
      noEnergyBody: (cost: number, minutes: number) => `Tracking costs ${cost} Energy for ${minutes} minutes. Energy refills over time, or tap Relay and turn on "Show me on the live map".`,
      earnByReporting: 'Relay an update',
      failedTitle: 'Tracking could not start',
      // PRD 14: tracking needs the live server
      offline: 'Tracking needs the internet. Connect to Wi-Fi or mobile data, then try again.',
    },
  },

  // Location on the Live tab (from the partner's GPS work, b21b0c1). Foreground only.
  location: {
    locateMe: 'Locate me',
    // CA1.1: Locate with a GPS position outside the offline map of Butuan
    outsideMapTitle: 'You are outside the Butuan map',
    outsideMapBody: 'Your location is not on the map, so the whole map is shown. In Demo & simulation, a simulated stop works anywhere.',
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
      {
        heading: 'What is used',
        body: "Your phone's position and how precise it is, while the app is open. In the background only while a relay you started is queued or running, with a notification, and only if you allow it.",
      },
      {
        heading: 'Why',
        body: 'To show you on the map, start a trip from where you are, confirm you are at a stop when you check in, mark a report as "with GPS", and find the multicab you are in by its Bluetooth signal when you relay (Android lets apps search for Bluetooth signals only with location).',
      },
      {
        heading: 'What leaves your phone',
        body: 'A check-in sends only the stop, and a Crowdsource relay only the nearest stop. A relay on the live map sends your position while it runs, to move the multicab; it is kept 7 days (24 hours at night).',
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
    near: (name: string) => `Near ${name}`,
    pinned: 'Pinned point',
    noRouteHere: 'No multicab route near here',
    pickAgain: (maxM: number) => `Tap a spot within ${meters(maxM)} of a route, or tap a stop.`,
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
    // Emjay, 2026-10-26: before a trip, a round star button opens these
    openSaved: 'Saved places and recent rides',
    savedTitle: 'Saved and recent',
    savedPlaces: 'Saved places',
    savedEmpty: 'Nothing saved yet. Tap the map or pick a stop; star a destination to keep it here.',
    useMyPosition: 'Use my position',
    currentLocation: 'Current location',
    you: (code: string) => `You (${code})`,
    clearField: (field: string) => `Clear ${field}`,
    distance: 'Distance',
    // One line per other route (Emjay, 2026-10-27): the walk in minutes only; its metres and the
    // free seats are on the route's own card
    summary: (rideKm: number, walkMin: number) => `${km(rideKm)} ride · ${Math.max(1, walkMin)} min walk`,
    // The fare card splits the summary over two lines, so "(20 m)" never wraps alone
    rideDistance: (rideKm: number) => `${km(rideKm)} ride`,
    walkTotal: (walkM: number, walkMin: number) => `${Math.max(1, walkMin)} min walk (${meters(walkM)})`,
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
    comingShort: (count: number) => `${count} coming`,
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
    // DR8: Bluetooth found the multicab on the check-in's route (PRD 7.5 auto-cancel)
    boardedTitle: (code: string, plate: string) => `Boarded ${code} · ${plate}`,
    boardedBody: 'Your check-in has ended. Enjoy the ride!',
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
    // A near check-in, by the spot it was made at: "Checked in · Near Flying V"
    compactSpot: (name: string) => `Checked in · ${name}`,
    // Emjay, 2026-11-02: the card names where the commuter stands, like My Rides names a point
    yourLocation: 'Your location',
    onRoute: 'On the route',
    unknownPlace: 'Location not known yet',
    routesNear: 'Routes passing here',
    checkInHere: 'Check in at your location',
    backToMe: 'Back to my location',
    nearCode: (code: string) => `Near ${code}`,
    stayNear: (metres: number) => `Stay within ${metres} m of this spot, or your check-in ends.`,
    stayAtStop: (metres: number) => `Stay within ${metres} m of the stop, or your check-in ends.`,
    leftTitle: 'Check-in ended',
    leftBody: (code: string) => `You moved away from ${code}, so drivers no longer count you there.`,
    farewellTitle: 'Safe travel!',
    farewellBody: (routes: string) => `Enjoy your ride on ${routes}. Your check-in has ended.`,
    farewellDone: 'Done',
    reminderTitle: (code: string) => `Still waiting at ${code}?`,
    // CA1.1: the reminder asks whether they boarded, as does a multicab standing at the stop
    reminderBody: (left: string) => `Did you board? Your check-in has ${left} left.`,
    boardQuestion: (code: string, label: string) => `Did you board ${code} · ${label}?`,
    boardStopped: (code: string, label: string, stop: string) => `${code} · ${label} has stopped at ${stop}.`,
    boardedYes: 'Yes, I boarded',
    notYet: 'Not yet',
    boarded: 'I boarded',
    cancel: 'Cancel',
    countdown: (time: string) => `${time} left`,
    countdownLabel: (code: string, time: string) => `Checked in at ${code}, ${time} left`,
    // C1
    waiting: (count: number) => (count === 1 ? '1 waiting' : `${count} waiting`),
    // CA3: the same refusal when checking in near the route
    notNearTitle: 'Check in near the route',
    tooFar: (distanceM: number, radiusM: number, code: string) =>
      `You are ${distanceM} m from ${code}. Check in within ${radiusM} m of the station.`,
    // CA2a, CA3: near the route
    tooFarFromLine: (lineM: number, limitM: number) => `You are ${lineM} m from the route. Stand by the road the multicab takes (within ${limitM} m) and try again.`,
    inaccurate: (gateM: number) => `Your location is not precise enough yet (needs ${gateM} m or better). Wait a moment outdoors and try again.`,
    // G0: a mock location app is on, or the last fix is too old
    mocked: 'Your phone reports a mock location. Turn off any mock location app to check in.',
    stale: 'Your last location is too old. Wait for a fresh fix and try again.',
    noPosition: 'Turn on location to check in. On the emulator, use a simulated stop in Demo & simulation.',
    failedTitle: 'Check-in failed',
    // PRD 14: a check-in is sent over the internet; shown on the station card and when the send fails
    offlineTitle: 'You are offline',
    offline: 'A check-in is sent over the internet. Connect to Wi-Fi or mobile data, then check in again.',
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
    // CA1.1: a check-in costs Energy for each route pinged
    cost: (cost: number, per: number, left: number) => `Costs ${cost.toFixed(1)} Energy (${per.toFixed(1)} per route) · you have ${left.toFixed(1)}`,
    noEnergyTitle: 'Not enough Energy',
    noEnergyBody: (per: number) => `A check-in costs ${per.toFixed(1)} Energy for each route. Energy refills over time, or tap Relay and turn on "Show me on the live map".`,
    pingLabel: (code: string, on: boolean) => `${code}, ${on ? 'pinged' : 'not pinged'}`,
    picked: 'Selected station',
    closeStation: 'Close this station',
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
    assistant: 'Ask Tunie',
    demo: 'Demo & simulation',
    about: 'About Tunton',
    replayIntro: 'Replay introduction',
    feedback: 'Give feedback',
    feedbackBody: 'A short survey about Tunton',
    feedbackFailedTitle: 'Could not open the survey',
    feedbackFailedBody: 'Check your connection and try again.',
    signIn: 'Sign in or create account',
    signOut: 'Sign out',
    signedInAs: (email: string) => `Signed in as ${email}`,
    guest: 'Not signed in',
  },

  // MOD1 (PRD 11.2, 11.3): Profile's Trust and safety, strikes, appeals and suspension
  moderation: {
    title: 'Trust and safety',
    trustLevel: (level: number) => `Trust Level ${level}%: the share of your recent reports nobody had to remove.`,
    trustLevelSoon: (reports: number, needed: number) => `Your Trust Level shows after ${needed} reports (${reports} so far).`,
    merit: (count: number) => (count > 0 ? `${count} Merit ${count === 1 ? 'shield' : 'shields'}: each one takes a strike for you.` : 'No Merit shields yet. They come with trust points.'),
    noStrikes: 'No strikes. Thank you for keeping Tunton accurate.',
    reasons: {
      confirmed_report: 'A moderator confirmed a report of yours was wrong.',
      auto_evidence: 'A report of yours was flagged and your phone showed a fake or impossible location.',
    } satisfies Record<StrikeReason, string>,
    strikeState: (strike: Pick<Strike, 'absorbed' | 'lifted' | 'appealState'>, at: Date, expires: Date) =>
      strike.lifted
        ? 'Lifted after your appeal.'
        : strike.absorbed
          ? `A Merit shield took it (${at.toLocaleDateString()}).`
          : strike.appealState === 'pending'
            ? 'Appeal sent; a moderator will decide.'
            : strike.appealState === 'rejected'
              ? `Appeal not upheld. Ends ${expires.toLocaleDateString()}.`
              : `Given ${at.toLocaleDateString()}, ends ${expires.toLocaleDateString()}.`,
    appeal: 'Appeal',
    suspendedTitle: 'Account suspended',
    suspendedBody: (until: Date) => `Two strikes within 30 days: you cannot relay, check in or flag until ${until.toLocaleString()}. You can still use the map, routes and fares, and appeal on your Profile.`,
    shieldTitle: 'A Merit shield was used',
    shieldBody: 'A report of yours was confirmed wrong, and one of your Merit shields took the strike. See Trust and safety on your Profile.',
    appealTitle: 'Appeal a strike',
    appealBody: 'Tell the moderator why the strike is a mistake. If they agree, it is lifted, and any suspension it caused ends.',
    appealPlaceholder: 'What happened?',
    appealCount: (length: number, max: number) => `${length}/${max}`,
    appealSend: 'Send appeal',
    appealSentTitle: 'Appeal sent',
    appealSentBody: 'A moderator will decide. You will see the result on your Profile.',
    appealFailedTitle: 'Appeal not sent',
    appealFailedBody: 'Check your connection and try again.',
    appealTooLate: 'Strikes can be appealed within 30 days.',
    appealExists: 'You already appealed this strike.',
  },

  // S10 (PRD 17.1): the field test log
  fieldLog: {
    title: 'Field test log',
    entry: 'Field test log',
    entryBody: 'Battery, data, Bluetooth and verification during relays',
    body: 'For the field experiments (docs/FIELD_TESTS.md). While recording, Tunton notes each relay, the battery every 5 minutes, the data it sends, background gaps, Bluetooth signal, verification results and who shares a multicab. It stays on this phone until you export it.',
    recording: 'Recording',
    events: (count: number) => `${count} ${count === 1 ? 'event' : 'events'} recorded`,
    summary: 'Summary',
    none: 'not measured yet',
    pctPerHour: '% per hour',
    kbPerHour: 'KB per hour',
    relays: (count: number, hours: number) => `${count} ${count === 1 ? 'relay' : 'relays'}, ${hours.toFixed(1)} h in all`,
    battery: (value: string) => `Battery while relaying: ${value}`,
    data: (value: string) => `Data sent while relaying: ${value} (target under 150 KB)`,
    gaps: (count: number) => `Background gaps (phone stopped Tunton): ${count}`,
    rssi: (count: number, median: number, min: number, max: number) => `Bluetooth signal: ${count} readings, median ${median} dBm (${min} to ${max})`,
    rssiNone: 'Bluetooth signal: no readings yet',
    verify: (rate: string, time: string) => `Verified rides: ${rate}, median time ${time}`,
    verifyNone: 'Verified rides: none checked yet',
    handoffs: (count: number) => `Baton handoffs to this phone: ${count}`,
    export: 'Export as CSV',
    exportTitle: 'Tunton field test log',
    clear: 'Clear the log',
    clearTitle: 'Clear the field test log?',
    clearBody: (count: number) => `This deletes ${count} recorded ${count === 1 ? 'event' : 'events'} from this phone. Export first if you need them.`,
    cancel: 'Cancel',
  },

  // Demo & simulation: what the emulator cannot do by itself; also works on a phone
  demo: {
    title: 'Demo & simulation',
    simulation: 'Simulation',
    demoVehicles: 'Simulated multicabs',
    demoVehiclesBody: 'Moving demo multicabs on every route, labelled "Demo"',
    simulatedLocation: 'Simulated location',
    simulatedLocationBody: 'Stand at a stop or a spot you pin, instead of using GPS',
    // CA1.1: the spot used while simulated location (or fake GPS) is on
    standSpot: 'Your simulated spot',
    standSpotBody: 'Pin it anywhere on the map, or pick a stop below',
    standAt: 'Stand at',
    standAtBody: 'Your position while simulated location or fake GPS is on',
    // CA1.1: a spot pinned on the map
    pinOnMap: 'Pin on map',
    pinnedSpot: 'Pinned spot',
    pinOnMapLabel: 'Pick any spot on the map to stand at',
    pinTitle: 'Pick your spot',
    pinBody: 'Move the map so the pin is where you want to stand.',
    pinUse: 'Use this spot',
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
      live_report: 'Relay on the live map',
      feed_report: 'Relay in Crowdsource',
      checkin: 'Check-in',
      passive: 'Refill',
      tracking: 'Tracked a multicab',
      welcome: 'Welcome Energy',
    } as Record<'gps_report' | 'no_gps_report' | 'live_report' | 'feed_report' | 'checkin' | 'passive' | 'tracking' | 'welcome', string>,
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

  // AU1: a release build without the backend keys (an account is needed and none can be made)
  noBackend: {
    title: 'Backend not configured',
    body: 'This build of Tunton cannot sign anyone in. Please install a build made with the backend settings.',
  },

  // AU1: the server answered that the session is gone
  signInAgain: {
    title: 'Please sign in again',
    body: 'Your session has ended. Sign in to keep using this feature.',
    signIn: 'Sign in',
    notNow: 'Not now',
  },

  // CA1: the assistant (PRD 19.5). It understands English and Bisaya questions and replies in
  // English; the answers are worked out on the phone. Offline (2026-11-02) it still answers trips,
  // fares and stops; only a route's live multicabs need the internet
  assistant: {
    title: 'Ask Tunie',
    open: 'Ask Tunie',
    placeholder: 'Ask about a trip, a fare or how to ride',
    send: 'Send',
    // CA1.1: the close button; the offline notice (2026-11-02)
    close: 'Close Ask Tunie',
    offlineNote: 'You are offline. Trips, fares and stops still work; live multicabs need the internet.',
    you: 'You',
    // The user's own position, as the answers name it
    yourLocation: 'your location',
    yourPin: 'your pin',
    youAt: (code: string) => `you at ${code}`,
    starters: [
      'How do I get to SM City Butuan?',
      'Is R4 running?',
      'Nearest stop',
      'Pila plete gikan Libertad paingon CSU?',
      'Tips for first-time riders',
    ],
    help: [
      "Hi! I'm Tunie. Ask me in English or Bisaya, for example:",
      '"from Libertad to CSU", "pila plete paingon Ampayon", "naa bay R4?", "asa ang pinakaduol nga sakayan?"',
      'New to multicabs? Ask "how do I pay?", "what do I say to get off?" or "tips for first-time riders".',
    ],
    // Commuter guide (2026-11-02): how to ride, for a visitor or a first-time rider. English, with the
    // Bisaya to say and how it sounds (capitals mark the stressed part).
    guide: {
      getOff: [
        'Say "Para!" (PAH-rah) or "Lugar lang, palihug" (loo-GAR lahng, pah-LEE-hoog), "please stop here", a little before your stop and loud enough for the driver.',
        'If it is noisy, many riders also tap a coin on the metal handrail or knock on the roof.',
        'Name a landmark the driver knows (SM, Robinsons, Gaisano, City Hall) rather than a side street.',
        'Wait until it has fully stopped, step down at the back, and watch for motorcycles passing beside it. Say "Salamat" (sah-LAH-maht), "thank you".',
      ],
      askDriver: [
        'Before you board, ask: "Moagi ba ni sa SM?" (mo-AH-gee bah nee sah SM), "Does this pass by SM?" Short form: "SM ni?"',
        'Or: "Asa ni padulong?" (AH-sah nee pah-DOO-long), "Where is this going?"',
        'To know where to get off: "Asa ko manaog para sa SM?" (AH-sah ko mah-NAH-og), "Where do I get off for SM?"',
        'Or ask to be told: "Palihug ingna ko kung naa na ta sa SM." (pah-LEE-hoog ing-NAH ko koong nah-AH nah tah sah), "Please tell me when we are at SM."',
        'For the fare: "Pila ang plete?" (PEE-lah ahng PLEH-teh), "How much is the fare?"',
      ],
      pay: [
        'Pay after you sit down. Say "Bayad, palihug. Usa ra." (BAH-yahd pah-LEE-hoog, OO-sah rah), "My fare, please. One person." For two, "Duha" (DOO-hah).',
        'Hand it to the rider next to you; it is passed along to the driver. Add where you are going on a long ride: "paingon SM" (pah-ee-NGON), "to SM".',
        'Your change, "sukli" (SOOK-lee), comes back the same way. Coins and small bills (₱20, ₱50) are best; break big bills before you ride.',
        'Student, senior or PWD? Say "Estudyante" (es-tood-YAHN-teh), "Senior" or "PWD" before you hand the fare, and show your ID for the discount.',
        'Unsure of the fare? Many multicabs post the official fare table inside.',
      ],
      flag: [
        'Check the route number and sign on the front of the multicab (R1 to R5, R14). Tunton shows which route goes where.',
        'Stand at a stop on the side of the road going your way, and raise your hand when it comes; eye contact with the driver helps.',
        'Board at the back, mind your head, and move inside so others can get on. Keep big bags out of the way.',
        'Check in at your stop in Tunton, so the drivers on that route know someone is waiting.',
      ],
            fareRules: (base: string, baseKm: number, perKm: string, discount: number) => [
        `The fare is ${base} for the first ${baseKm} km, then ${perKm} for each further km.`,
        `Students, seniors and PWD get ${discount}% off with a valid ID.`,
        "Tunton's fares are estimates from the distance; the official fare table may differ a little.",
      ],
      lost: [
        'Do not worry. Tell the driver where you want to go as soon as you notice; they often know which route to take.',
        'Get off at a busy, well-lit place ("Para!" or "Lugar lang"), and cross only at a proper crossing.',
        'Tap Locate me on the Map, then ask me how to get there, or use My Rides. The same route going the other way often brings you back.',
        'You can ask people: "Asa ko makasakay paingon SM?" (AH-sah ko mah-kah-SAH-kai pah-ee-NGON), "Where can I ride to SM?"',
      ],
      safety: [
        'Keep your bag on your lap or in front of you, and hold your phone close, mostly near the open back and at busy corners.',
        'Note the plate number painted on the multicab before you board.',
        'Step down only once it has stopped, and look out for motorcycles passing on the side.',
        'If a ride feels unsafe, get off at a busy place and wait for the next one. In an emergency, call 911.',
      ],
      night: [
        'Fewer multicabs run late at night, so leave earlier when you can.',
        'From 9 PM to 5 AM Tunton is in Night Mode and shows only multicabs that are stopped.',
        'Wait at a lit stop with other people, sit near the driver, stay awake, and get off in a well-lit area.',
      ],
      etiquette: [
        "Help pass other riders' fares and change, even when you are not paying; ignoring a passed fare is rude. Hands full? Say \"Kadiyot\" (kah-dee-YOT), \"one moment\".",
        'Move inside along the bench to make room: "Palihug usog" (pah-LEE-hoog OO-sog), "Please move over". Keep your bag on your lap, not on the seat.',
        'Give your seat to seniors, pregnant women, parents with small children and persons with disability.',
        'Keep calls short, use earphones for music, and avoid eating strong-smelling food.',
        'Say "Salamat" or nod to the driver when you get off.',
      ],
      phrases: [
        '"Para!" (PAH-rah) or "Lugar lang" (loo-GAR lahng): stop here.',
        '"Bayad, palihug. Usa ra." (BAH-yahd pah-LEE-hoog, OO-sah rah): my fare, please, one person.',
        '"Sukli" (SOOK-lee): change. "Palihug" (pah-LEE-hoog): please. "Kadiyot" (kah-dee-YOT): one moment.',
        '"Salamat" (sah-LAH-maht): thank you. "Oo" (OH-oh): yes. "Dili" (DEE-lee): no.',
        '"Pila ang plete?" (PEE-lah ahng PLEH-teh): how much is the fare?',
        '"Moagi ba ni sa SM?" (mo-AH-gee bah nee sah SM): does this pass by SM?',
        '"Asa ko manaog para sa SM?" (AH-sah ko mah-NAH-og): where do I get off for SM?',
        '"Wala koy barya" (WAH-lah koy BAR-yah): I have no small change.',
      ],
      visitor: [
        'Welcome to Butuan! Riding a multicab in four steps:',
        '1. Find your route: ask me "how do I get to SM?" or use My Rides.',
        '2. Wave at a multicab with that route number and board at the back.',
        '3. Sit, then pay: say "Bayad, palihug" and hand the fare to the rider next to you.',
        '4. Say "Para!" (or tap a coin on the handrail) a little before your stop, and step down once it stops.',
        'Ask me about any step, or the words to say.',
      ],
      multicab: [
        'A multicab is a small public vehicle, like a mini jeepney, with two benches facing each other at the back.',
        'Each one runs a fixed route (R1 to R5 and R14 in Butuan) and stops anywhere along it when a rider waves or says "Para!".',
        'You pay the driver after you sit down. Tunton shows the routes, the fares and the multicabs nearby.',
      ],
    },
    tripRoute: (code: string, name: string) => `Ride ${code}, ${name}.`,
    tripFare: (fare: string, fareType: string) => `Fare ${fare} (${fareType}).`,
    tripEnds: (from: string, to: string, distance: string) => `From ${from} to ${to}, ${distance} on the multicab.`,
    tripWalks: (toRoute: string, fromRoute: string) => `Walk ${toRoute} to the route and ${fromRoute} at the end.`,
    tripOthers: (codes: string) => `${codes} also go there.`,
    tripFail: {
      origin_too_far: (place: string, distance: string) => `${place} is ${distance} from the nearest route, too far to walk.`,
      destination_too_far: (place: string, distance: string) => `${place} is ${distance} from the nearest route, too far to walk.`,
      destination_not_ahead: (from: string, to: string) => `No single route goes from ${from} to ${to}.`,
      no_routes: (from: string, to: string) => `No route goes from ${from} to ${to}.`,
      same_place: (from: string, to: string) => `${from} and ${to} are the same place.`,
    } satisfies Record<PlanFailure | 'same_place', (a: string, b: string) => string>,
    // CA1.1: a name typed in part, or with a typo, is answered for the place it was taken as
    showingFor: (title: string) => `Showing results for ${title}:`,
    correctedFor: (title: string, typed: string) => `Did you mean ${title}? Showing results for it ("${typed}" not found):`,
    notFound: (text: string) => `I could not find "${text}". Try a stop, a building or a barangay.`,
    // A name that fits several places: asked about before answering
    whichPlace: (text: string) => `Which "${text}" do you mean?`,
    needPosition: 'I need to know where you are. Turn on location, or long-press the Map to drop a pin, then ask again.',
    needPositionFrom: 'Or name where you start: "from Libertad to CSU".',
    needDestination: 'Where are you going? For example "to SM City Butuan".',
    whichRoute: 'Which route? Tap one:',
    unknownRoute: (code: string, routes: string) => `There is no ${code} here. The routes are ${routes}.`,
    statusLive: (code: string, count: number) => `${code} is running: ${count} live multicab${count === 1 ? '' : 's'} now.`,
    statusNoLive: (code: string) => `No live multicab on ${code} right now.`,
    statusEstimated: (count: number) => `${count} more ${count === 1 ? 'was' : 'were'} seen in the last 5 minutes (Estimated).`,
    statusStale: (count: number, age: string) => `${count} older position${count === 1 ? '' : 's'}, the newest ${age} ago (Stale).`,
    statusNoData: 'No data from riders on it at the moment.',
    statusNight: 'Night Mode: moving multicabs are hidden.',
    statusAlternative: (code: string, distance: string) => `${code} is running nearby (${distance}) and shares stops with it.`,
    statusHidden: 'Live multicabs are for team accounts only for now.',
    statusOffline: (code: string) => `You are offline, so the live multicabs on ${code} cannot be shown. Its line and stops are on the map.`,
    statusLoading: (code: string) => `Checking ${code}…`,
    nearest: (code: string, name: string, distance: string, from: string) => `The nearest stop to ${from} is ${name} (${code}), ${distance} away.`,
    nearestRoutes: (codes: string) => `Routes there: ${codes}.`,
    and: (items: readonly string[]) =>
      items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`,
    chips: {
      openTrip: 'Open in My Rides',
      viewRoute: (code: string) => `View ${code} on the map`,
      status: (code: string) => `Is ${code} running?`,
      openMap: 'Open the Map',
      // CA1.1: another place that fits the name as well
      didYouMean: (title: string, near: string | undefined) => `Did you mean ${near ? `${title}, ${near}` : title}?`,
      place: (title: string, near: string | undefined) => (near ? `${title}, ${near}` : title),
      // Commuter guide: each topic asked as a question (parses back to the same topic)
      guide: {
        getOff: 'How do I get off?',
        askDriver: 'What do I say to the driver?',
        pay: 'How do I pay?',
        flag: 'How do I flag a multicab?',
        fareRules: 'How is the fare computed?',
        lost: 'I took the wrong route',
        safety: 'Is it safe?',
        night: 'Riding at night',
        etiquette: 'Where do I sit?',
        phrases: 'Useful Bisaya phrases',
        visitor: 'Tips for first-time riders',
        multicab: 'What is a multicab?',
      },
    },
  },

  // ST2-D: the tips tour, one bubble per control on the Map tab
  tour: {
    steps: {
      profile: { title: 'Your profile', body: 'Your avatar, username and fare type. Tap it for your badges.' },
      menu: { title: 'Menu', body: 'Settings, your places, and this tour again.' },
      zoom: { title: 'Zoom', body: 'Zoom in and out one step at a time.' },
      routes: { title: 'Routes', body: 'Pick a route to see its line, stops and multicabs.' },
      ask: { title: 'Ask Tunie', body: 'Ask for a trip, a fare, a route or the nearest stop, in English or Bisaya.' },
      locate: { title: 'Where you are', body: 'Tap to zoom in on you; tap again to see all of Butuan.' },
      checkin: { title: 'Check in', body: 'Waiting at a stop? Check in so drivers know someone is there.' },
      ride: { title: 'My Rides', body: 'Where are you heading? The fare and the routes that take you there.' },
      relay: { title: 'Relay a multicab', body: 'On a multicab? Tell others if it has seats, is full or stuck in traffic.' },
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
    checkin: 'Check in where you stand',
    ride: 'Where are you going?',
    dismiss: 'Dismiss tip',
  },

  // F5: badges from the user's own counts (D8); no ranking
  badges: {
    // BG1: not "Trust Badges": the Trusted commuter shield has its own rule
    title: (earned: number, total: number) => `Badges (${earned}/${total})`,
    // BG1: every badge earned
    regular: 'Tunton regular',
    regularLabel: 'Tunton regular: every badge earned',
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
    // AU1: the introduction replayed while signed in, or a development build with no backend
    continue: 'Continue',
    welcomeNote: 'No phone number needed · Works offline once you are signed in',
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
      // DR8: Nearby devices is asked when Relay first looks for the multicab, not here
      nearby: { title: 'Nearby multicab detection', body: 'Finds the multicab you board, by Bluetooth', status: 'In Relay' },
      // Built (tracking panel, Settings): an in-app alert, so there is no permission to ask here
      alerts: { title: 'Arrival alerts', body: 'Tells you when your multicab is near, and when to get off on a relay', status: 'In Tracking and Relay' },
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

  // The driver app (docs/IMPLEMENTATION_PLAN_DRIVER.md; DR1, DR4). Large, short, read at a glance;
  // nothing on the home screen needs a tap (PRD 15.3).
  driver: {
    appName: 'Tunton Driver',
    notProvisioned: 'Not set up yet',
    notProvisionedBody: 'An admin sets up this phone for one multicab with a setup code.',
    route: (code: string) => `Route ${code.slice(1)}`,
    vehiclePlate: 'Vehicle plate',
    // DR5: the heatmap. Never "no one waiting" when the truth is "no update" (PRD 2.3).
    heatmap: {
      title: 'Waiting passengers',
      never: 'No update yet',
      justNow: 'Updated just now',
      updated: (min: number) => `Updated ${min} min ago`,
      // Owner, 2026-10-18: an hour or more as hours and minutes ("No update for 1 hr 6 min")
      stale: (hours: number, min: number) =>
        hours === 0 ? `No update for ${min} min` : min === 0 ? `No update for ${hours} hr` : `No update for ${hours} hr ${min} min`,
      staleBody: 'These counts are old. They may have changed.',
      // Band labels, by band index (HEATMAP_BAND_EDGES)
      bands: ['0', '1–4', '5–9', '10+'],
      unknown: '—',
      unknownLabel: 'No count yet',
      bandsOnly: 'Ranges only at night',
      waiting: (count: number) => `${count} waiting`,
      // CA3: checked in near the stop, on a line under it
      near: '– Near',
      nearLabel: (count: number) => `${count} near the stop`,
      nearSomeone: '– Someone near',
      noStops: 'No stops for this route in this version of the app.',
      mapUnavailable: 'The map could not load. The list still works.',
      // The map's round buttons and the colour key over the list (owner's request 2026-10-14)
      // The stop with the most passengers waiting, over the list (owner, 2026-10-14)
      mostWaiting: 'Most waiting',
      mostWaitingLabel: (name: string, value: string) => `Most waiting: ${name}, ${value}`,
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      defaultView: 'Show the whole route',
      hideNames: 'Hide stop names',
      showNames: 'Show stop names',
      legend: {
        light: 'Light',
        moderate: 'Moderate',
        crowded: 'Crowded',
        label: (name: string, range: string) => `${name} (${range})`,
      },
    },
    // The home screen's warnings: the problem, then what to do in bold (Stitch 3.5)
    smsMissing: 'Text messages are off. Waiting counts cannot arrive.',
    askAdmin: 'Ask an admin.',
    clock: {
      // Checked only against the carrier's time on a heatmap text, so before the first one it waits
      unknown: 'Clock: no text yet',
      ok: 'Clock OK',
      // driftS > 0: the phone is ahead
      off: (minutes: number) => `Clock off by ${minutes} min`,
      offSeconds: (seconds: number) => `Clock off by ${seconds} s`,
    },
    beaconOn: 'Beacon on',
    beaconOff: 'Beacon off',
    beaconStarting: 'Beacon starting',
    beaconRestarting: 'Beacon restarting',
    bluetoothOff: 'Bluetooth is off',
    battery: (percent: number) => `${percent}%`,
    charging: 'Charging',
    holdForAdmin: 'Hold here 3 s for admin',
    resetNeeded: 'This phone must be set up again.',
    // Owner, 2026-10-28: a signed text from the gateway says an admin retired this phone
    retiredTitle: 'This phone was removed from Tunton.',
    retiredBody: 'An admin retired it, so the beacon and the waiting counts have stopped. To drive with Tunton again, register this phone again.',
    registerAgain: 'Register again',
    beaconError: {
      not_provisioned: 'Not set up',
      no_permission: 'Nearby devices permission is off',
      bluetooth_off: 'Bluetooth is off',
      not_supported: 'This phone cannot act as a beacon',
      not_available: 'This build has no beacon',
      other: 'Beacon stopped',
    },
    notification: {
      title: 'Tunton beacon on',
      text: 'Commuters can tell this multicab is theirs.',
      // Backlog 134: posted by the phone when a retire notice arrives while the app is closed (the
      // title is driver.retiredTitle)
      retiredText: 'The beacon is off. Open Tunton Driver to register again.',
    },
    // The phone-side setup steps the registration screens share: permissions, the SMS restricted-setting
    // fix and the beacon (the setup QR they came from is gone: owner, 2026-10-28)
    setup: {
      nearbyTitle: 'Nearby devices',
      nearbyBody: 'Lets commuters’ phones find this multicab.',
      notificationsTitle: 'Notifications',
      notificationsBody: 'Shows that the beacon is on.',
      allow: 'Continue',
      permissionDenied: 'Nearby devices was not allowed. The beacon cannot start without it.',
      smsWhy: 'To receive waiting counts by text',
      smsPrivacy: 'Tunton reads only its own messages, never personal texts.',
      // Android 13+ blocks SMS permissions for an app installed outside the Play Store until this is
      // allowed in the app's settings (Stitch 3.9: the fix as three steps)
      smsDeniedTitle: 'Text messages were not allowed.',
      smsRestricted: 'If Android says this is a restricted setting:',
      // Backlog 118: most phones have the ⋮ menu; HONOR (MagicOS) shows a banner on App info instead
      smsSteps: {
        open: 'Tap Open settings.',
        allow: 'Tap ⋮ (top right), then “Allow restricted settings”. No ⋮? Tap “Remove restriction” on the banner, then enter the screen lock.',
        back: 'Come back here and tap Try again.',
      },
      openSettings: 'Open settings',
      tryAgain: 'Try again',
      cannotBeacon: 'This phone cannot act as a beacon. Use another phone model.',
      bluetoothFirst: 'Turn on Bluetooth, then try again.',
      failed: 'Setup failed. Try again.',
    },
    // DRG4: registering this phone (PRD 9.5). The driver needs internet now and once after approval.
    register: {
      title: 'Register this phone',
      welcomeTitle: 'Set up Tunton Driver',
      welcomeBody: 'Register this phone to your multicab. An admin checks your details, then the phone works without internet.',
      needTitle: 'You need',
      needInternet: 'Internet now (Wi-Fi or mobile data)',
      needId: 'Your CTTDM driver ID',
      needVehicle: 'Your multicab, to photograph its plate',
      start: 'Register this phone',
      // Permissions first, so nothing is left to allow after approval
      permissionsTitle: 'Allow these first',
      permissionsBody: 'The waiting counts arrive by text message, and the beacon needs Bluetooth. Allow them now, so nothing is left after approval.',
      numberTitle: 'Your mobile number',
      numberBody: 'The number of the SIM in this phone. The approval and the waiting counts are texted to it, so check it twice.',
      numberPlaceholder: '09XX XXX XXXX',
      numberSaving: 'Saving…',
      vehicleTitle: 'Your multicab',
      plateLabel: 'Plate number',
      platePlaceholder: 'ABC 1234',
      plateInvalid: 'Type the plate as on the multicab, letters and numbers.',
      routeLabel: 'Route',
      next: 'Next',
      photosTitle: 'Two photos',
      consentTitle: 'Why we ask for photos',
      consentBody:
        'An admin of the Tunton project looks at your CTTDM driver ID and your plate number to approve this phone. Only the admin sees them, and both photos are deleted as soon as the admin decides.',
      photoId: 'Your CTTDM driver ID',
      photoIdHint: 'The whole ID, flat, in good light.',
      photoVehicle: 'Your plate number',
      photoVehicleHint: 'The plate on your multicab, clearly, and the route sign if you can.',
      takePhoto: 'Take photo',
      retake: 'Take again',
      capture: 'Capture',
      cancel: 'Cancel',
      uploading: 'Sending the photo…',
      uploaded: 'Sent',
      allowCamera: 'Allow camera',
      cameraNeeded: 'The camera is needed for the photos.',
      cameraBlocked: 'The camera is off for this app. Open settings, Permissions, Camera, and allow it.',
      reviewTitle: 'Check and send',
      reviewNumber: 'Mobile number',
      reviewPlate: 'Plate',
      reviewRoute: 'Route',
      reviewPhotos: 'Photos',
      reviewPhotosSent: 'Both sent',
      reviewEdit: 'Edit',
      reviewEditAll: 'Edit your details',
      newNumberPhotos: 'A different number means taking the two photos again. The plate and route stay.',
      submit: 'Send for approval',
      sending: 'Sending…',
      waitingTitle: 'Waiting for approval',
      waitingBody: 'An admin checks your ID and multicab. You get a text when this phone is approved.',
      waitingKeep: 'Keep this app. When approved, open it while connected to the internet.',
      checkNow: 'Check now',
      checking: 'Checking…',
      approvedTitle: 'Approved',
      approvedBody: 'Setting up this phone…',
      notReady: 'Approved, but the setup is not ready yet. Ask an admin.',
      rejectedTitle: 'Not approved',
      rejectedReason: (reason: string) => `Reason: ${reason}`,
      expiredTitle: 'This registration has expired',
      expiredBody: 'It was not finished in time, or a newer one replaced it. Register again.',
      registerAgain: 'Register again',
      doneTitle: 'This phone is set up',
      doneBody: 'The beacon is on. Commuters’ phones can now find this multicab.',
      done: 'Done',
      // The registration function's refusals, and the phone's own problems
      errors: {
        offline: 'No internet. Connect to Wi-Fi or mobile data, then try again.',
        not_configured: 'This version of the app cannot register. Ask an admin.',
        server_error: 'Something went wrong. Try again in a minute.',
        invalid_number: 'That is not a Philippine mobile number. Use the 11 digits, starting 09.',
        number_limit: 'This number was entered 3 times today. Try again tomorrow.',
        daily_limit: 'Too many registrations today. Try again tomorrow.',
        check_not_verified: 'It has been over an hour since the number was entered. Start again.',
        photos_missing: 'A photo did not arrive. Take it again.',
        invalid_plate: 'Type the plate as on the multicab, letters and numbers.',
        invalid_route: 'Pick your route.',
        too_big: 'That photo is too large. Take it again.',
        upload_failed: 'The photo could not be sent. Try again.',
        unknown: 'Something went wrong. Try again.',
      } as Record<string, string>,
    },
    admin: {
      title: 'Admin',
      pinPrompt: 'Admin PIN',
      pinProgress: (entered: number, total: number) => `${entered} of ${total} digits entered`,
      clear: 'Clear',
      deleteDigit: 'Delete last digit',
      unlock: 'Unlock',
      wrongPin: 'Wrong PIN.',
      device: (deviceId: string, shortId: number) => `${deviceId} · beacon ${shortId}`,
      code: (payloadHex: string, slot: number) => `Code ${payloadHex} · slot ${slot}`,
      noCode: 'No code yet',
      turnOff: 'Turn beacon off',
      turnOn: 'Turn beacon on',
      setUpAgain: 'Set up again',
      setUpAgainConfirm: 'This removes this phone’s setup. The phone then registers again, and an admin approves it again.',
      // DR5: what arrived by SMS (no message bodies are kept)
      smsTitle: 'Heatmap messages',
      accepted: (count: number) => `${count} accepted`,
      inbox: (count: number) => `${count} waiting in the inbox`,
      smsOff: 'Text messages permission is off',
      smsAllow: 'Allow text messages',
      rejected: 'Dropped, by reason',
      noneRejected: 'None dropped',
      recentTitle: 'Recent',
      noRecent: 'No heatmap message yet',
      logLine: (time: string, kind: string, outcome: string, seq: number | null) => `${time} · ${kind} · ${outcome}${seq === null ? '' : ` · #${seq}`}`,
      clockDrift: (seconds: number) => `Clock ${seconds >= 0 ? 'ahead' : 'behind'} by ${Math.abs(Math.round(seconds))} s`,
    },
  },

  // The gateway app (DR1, DR5 carrier test, DR7)
  gateway: {
    appName: 'Tunton Gateway',
    // A SIM by its slot and network family (shared/sms/carrier.ts), such as "SIM 1 · Globe/TM"
    simName: (slot: number, network: string | null) => (network ? `SIM ${slot} · ${network}` : `SIM ${slot}`),
    // DR7: the sending service, its setup and its screens
    notification: {
      title: 'Tunton gateway on',
      text: 'Sending waiting counts to drivers by text.',
    },
    status: {
      notSetUp: 'Not set up',
      stopped: 'Stopped',
      restarting: 'Restarting…',
      restartFailed: 'Stopped by the phone. Could not restart it: unlock Admin, stop and start sending.',
      connecting: 'Connecting to the worker…',
      running: 'Running',
      unauthorized: 'The worker refused this phone. Set it up again.',
      unreachable: 'Cannot reach the worker',
      quiet: (min: number) => `No contact with the worker for ${min} min`,
    },
    home: {
      gateway: (id: string) => `Gateway ${id}`,
      worker: 'Worker',
      lastPull: (seconds: number) => `Last check ${seconds} s ago`,
      never: 'Not checked yet',
      today: 'Today',
      counts: (sent: number, delivered: number, failed: number) => `${sent} sent · ${delivered} delivered · ${failed} failed`,
      lastError: (error: string) => `Last problem: ${error}`,
      phone: 'This phone',
      battery: (percent: number, charging: boolean) => `Battery ${percent}% · ${charging ? 'charging' : 'NOT charging'}`,
      sim: (label: string) => `SIM: ${label}`,
      simDefault: 'the phone’s default',
      batteryOptimised: 'Android may pause this app to save battery. Allow it to run in the background.',
      allowBackground: 'Allow background',
      smsOff: 'SMS permission is off: nothing can be sent.',
      adminTitle: 'Admin',
      pin: 'Admin PIN',
      unlock: 'Unlock',
      wrongPin: 'Wrong PIN.',
      start: 'Start sending',
      stop: 'Stop sending',
      log: 'Event log',
      setUpAgain: 'Set up again',
      setUpAgainConfirm: 'This removes this phone’s setup and its access to the worker. You need a new setup code.',
    },
    setup: {
      title: 'Set up the gateway',
      step: (n: number, total: number) => `STEP ${n} OF ${total}`,
      scanTitle: 'Scan the gateway setup code',
      scanBody: 'Point the camera at the code from provision-gateway.ts on the admin computer.',
      cameraNeeded: 'The camera is needed to read the setup code.',
      allowCamera: 'Allow camera',
      invalid: {
        malformed: 'That is not a Tunton gateway setup code.',
        wrong_kind: 'That code is for a driver phone, not the gateway.',
        wrong_version: 'That code is from another version. Ask for a new one.',
        expired: 'That code has expired. Ask for a new one.',
        insecure_url: 'That code’s worker address is not HTTPS.',
      },
      httpInRelease: 'This build needs an HTTPS worker address (a tunnel). http://localhost works only in a development build.',
      confirmTitle: 'Is this the gateway?',
      confirmBody: (id: string, url: string) => `${id}, sending for the worker at ${url}`,
      yes: 'Yes, set up',
      scanAgain: 'Scan again',
      permissionsTitle: 'Permissions',
      permissionsBody: 'SMS sends the waiting counts. Phone lets you pick the SIM. Notifications show that the gateway is on.',
      allow: 'Allow',
      smsDenied:
        'SMS was not allowed. If Android says this is a restricted setting: open Settings, tap ⋮ (top right), Allow restricted settings, then come back and try again.',
      openSettings: 'Open settings',
      tryAgain: 'Try again',
      batteryTitle: 'Run in the background',
      batteryBody: 'The gateway must keep sending with the screen off. Allow it to ignore battery optimisation.',
      batteryDone: 'Allowed: Android will not pause the gateway.',
      continue: 'Continue',
      simTitle: 'Which SIM sends?',
      simBody: 'Pick the SIM that has load and the SMS plan.',
      // Android listed no SIM (the Phone permission was refused): sending still works, from the
      // phone's default SIM for texts
      simNone: 'Android did not list the SIMs. Texts will go from the phone’s default SIM for messages.',
      testTitle: 'Send a test text',
      testBody: 'Send one text to a team phone to check the SIM works. You can skip this.',
      testNumber: 'Team phone number',
      sendTest: 'Send test',
      testText: 'Tunton gateway test',
      testResult: (sent: string, delivered: string) => `Sent: ${sent} · Delivered: ${delivered}`,
      waiting: 'waiting…',
      skip: 'Skip',
      starting: 'Starting the gateway…',
      failed: 'The gateway could not start. Try again.',
      doneTitle: 'Gateway on',
      doneBody: 'It now checks the worker every few seconds and sends what is waiting. Keep it on the charger.',
      done: 'Done',
    },
    log: {
      title: 'Event log',
      empty: 'No events yet',
    },
    // DR5: the carrier test, in development builds only (device test DR5-M5)
    spike: {
      open: 'Carrier test',
      title: 'Carrier test',
      intro: 'Sends signed test heatmap messages to a driver phone. Development builds only.',
      to: 'Driver phone number',
      key: 'SMS key of that phone (64 hex)',
      route: 'Route',
      seq: 'Next sequence number',
      sim: 'SIM',
      noSims: 'No SIM listed (allow Phone)',
      count: 'How many',
      padStops: 'Extra stops (to test size)',
      sendText: 'Send text',
      sendData: 'Send data',
      permissions: 'Allow SMS and Phone',
      smsOff:
        'SMS permission is off, so nothing can be sent. Tap Allow. If no prompt appears, Android treats it as a restricted setting: Open settings, ⋮ (top right), Allow restricted settings, then Permissions, SMS and Phone: Allow.',
      openSettings: 'Open settings',
      size: (bytes: number, septets: number) => `Data ${bytes} bytes · text ${septets} septets`,
      invalid: 'Check the number (0917… or +63917…) and the key.',
      results: 'Results',
      none: 'Nothing sent yet',
      line: (n: number, kind: string, sent: string, delivered: string) => `#${n} ${kind} · sent ${sent} · delivered ${delivered}`,
      pending: '…',
    },
  },

  // DRG5: the admin console (admin/), a web page for the research team (PRD 9.5)
  adminConsole: {
    title: 'Admin Console',
    brandSub: 'Driver Registrations',
    sections: 'Sections',
    when: (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    time: (ms: number) => new Date(ms).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
    whenFull: (iso: string) =>
      new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    updated: (time: string) => `Updated ${time}`,
    notConfigured:
      'This copy of the console has no Supabase address. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then build it again.',
    signIn: {
      place: 'Driver registrations, Butuan City',
      heading: 'Sign in',
      body: 'Driver registrations wait here for the research team to review.',
      email: 'Email',
      password: 'Password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      submit: 'Sign in',
      busy: 'Signing in…',
      wrong: 'Wrong email or password.',
    },
    signOut: 'Sign out',
    notAdmin: 'This account is not the admin account. Sign out, then sign in with the admin account.',
    offline: 'Cannot reach Supabase. Check the internet connection, then try again.',
    failed: (detail: string) => `That did not work: ${detail}`,
    loading: 'Loading…',
    refresh: 'Refresh',
    // The route filter on Registrations and Drivers; each option is the route's code (R4)
    routeFilter: { label: 'Route', all: 'All routes' },
    tabs: {
      registrations: 'Registrations',
      drivers: 'Drivers',
      settings: 'Settings',
    },
    registrations: {
      title: 'Registrations',
      waitingHeading: (count: number) => (count === 0 ? 'Nothing to review' : count === 1 ? '1 registration to review' : `${count} registrations to review`),
      position: (n: number, total: number) => `Registration ${n} of ${total}`,
      enlargeHint: 'Click to enlarge',
      routeLabel: 'Route',
      numberLabel: 'Mobile number',
      rejectingNote: 'Choose the reason below, then reject.',
      driverSeesIt: 'The driver sees this in the Tunton Driver app.',
      // The tabs by status (approved includes approved and already set up; expired shows only under All)
      tabsLabel: 'Registrations by status',
      tabs: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', all: 'All applications' },
      routeEmpty: (route: string) => `Nothing here on ${route}.`,
      clearRoute: 'Show all routes',
      tabEmpty: {
        pending: 'Nothing to review.',
        approved: 'No approved registrations yet.',
        rejected: 'No rejected registrations.',
        all: 'No registrations yet.',
      },
      none: 'New registrations appear here by themselves.',
      howToCheck: 'Approve when the ID is a valid CTTDM driver ID and the plate number photo matches the typed plate.',
      pinMissing: 'Set the admin PIN in Settings first. Approving stays off until then, because an approved phone cannot collect its setup without it.',
      idPhoto: 'CTTDM driver ID',
      vehiclePhoto: 'Plate number',
      noPhoto: 'No photo',
      photoFailed: 'The photo did not load. Refresh to try again.',
      enlarge: (what: string) => `Show the ${what} photo larger`,
      close: 'Close',
      typedPlate: 'Typed plate',
      route: (route: string) => `Route ${route}`,
      sent: (when: string) => `Sent ${when}`,
      replaces: (device: string) =>
        `This plate already has a phone, ${device}. Approving replaces it: the old phone stops working when the new one collects its setup.`,
      approve: 'Approve',
      reject: 'Reject',
      confirmApprove: (plate: string, route: string, phone: string) =>
        `Approve ${plate} on route ${route}?\n\nThis sends one text to ${phone}: "You're approved. Open Tunton Driver while connected to the internet."`,
      confirmReplace: (device: string) => `\n\n${device} stops working when the new phone collects its setup.`,
      reasonLabel: 'Reason the driver sees',
      reasonPicks: [
        'The ID photo is not readable.',
        'The ID is not a CTTDM driver ID.',
        'The plate in the photo does not match the typed plate.',
        'The plate number is not readable in the photo.',
      ],
      reasonLength: (length: number, max: number) => `${length} of ${max} characters`,
      sendRejection: 'Reject registration',
      cancel: 'Cancel',
      saving: 'Saving…',
      notPending: 'This registration was already decided. Refresh to see it.',
      photosStillStored: 'Photos not deleted yet. The console tries again at each refresh.',
      columns: { plate: 'Plate', route: 'Route', number: 'Number', outcome: 'Status', when: 'Last change' },
      status: {
        pending: 'Waiting for review',
        approved: 'Approved, setup not collected yet',
        collected: 'Approved and set up',
        rejected: 'Rejected',
        expired: 'Expired',
      },
    },
    drivers: {
      title: 'Drivers',
      heading: (count: number) => (count === 1 ? '1 driver phone' : `${count} driver phones`),
      tableHeading: 'Active driver phones',
      tableBody: 'These phones receive the waiting counts by SMS, newest set up first. Retire one to stop it at once.',
      showing: (shown: number, total: number) =>
        shown === total ? (total === 1 ? 'Showing 1 phone' : `Showing ${total} phones`) : `Showing ${shown} of ${total} phones`,
      searchLabel: 'Search plate number',
      searchPlaceholder: 'Plate number',
      noMatch: 'No driver phone matches. Change the route or the plate number searched.',
      clearFilters: 'Clear',
      emptyHeading: 'No driver phones yet',
      none: 'No driver phone is set up yet. Approved registrations appear here once the phone collects its setup.',
      viewRegistrations: 'View registrations',
      dismiss: 'Dismiss',
      columns: { device: 'Driver ID', plate: 'Plate', route: 'Route', number: 'Number', since: 'Set up' },
      noNumber: 'Not recorded',
      view: 'View',
      viewLabel: (device: string) => `View ${device}`,
      // The driver's details, opened with View
      details: {
        title: 'Driver details',
        status: 'Status',
        active: 'Active',
        driverId: 'Driver ID',
        plate: 'Plate',
        route: 'Route',
        number: 'Mobile number',
        registered: 'Registered',
        approved: 'Approved',
        notRecorded: 'Not recorded',
        noRegistration: 'No registration is on record for this phone. It was set up before registration, or its registration is older than the console lists.',
        close: 'Close',
      },
      retire: 'Retire',
      confirmRetire: (device: string, plate: string) =>
        `Retire ${device} (${plate})?\n\nThe phone stops working at once, and the multicab gets a new beacon secret. This sends the phone one text, so the driver app says it was removed. To use the app again, the driver registers again.`,
      retired: (device: string) => `${device} is retired.`,
    },
    settings: {
      title: 'Settings',
      subtitle: 'What every pilot driver phone gets with its setup',
      showPin: 'Show PIN',
      hidePin: 'Hide PIN',
      clear: 'Clear',
      pinHeading: 'Admin PIN of the driver phones',
      pinBody: 'One PIN opens the Admin screen on every pilot driver phone. Drivers are not told it.',
      pinSet: 'A PIN is set. Saving a new one changes it for phones set up from now on; phones already set up keep the PIN they have.',
      pinNotSet: 'No PIN is set yet. Approved phones cannot collect their setup until one is.',
      newPin: (digits: number) => `New PIN (${digits} digits)`,
      pinAgain: 'New PIN again',
      pinInvalid: (digits: number) => `The PIN is ${digits} digits.`,
      pinMismatch: 'The two PINs differ.',
      savePin: 'Save PIN',
      pinSaved: 'PIN saved.',
      account: (email: string) => `Signed in as ${email}`,
    },
  },

  dev: {
    overlay: (install: string, mapStatus: string) => `DEV  tiles: ${install}  map: ${mapStatus}`,
    camera: (zoom: number, lon: number, lat: number) =>
      `zoom ${zoom.toFixed(2)}  centre ${lon.toFixed(4)}, ${lat.toFixed(4)}`,
    cameraIdle: 'camera not moved yet',
  },
};

export type Strings = typeof en;

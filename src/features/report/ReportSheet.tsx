import { router } from 'expo-router';
import { MapPin, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip } from '@/components';
import type { VehiclesRepository } from '@/data/repositories/types';
import { useBoardingEndsCheckIn } from '@/features/checkin/useBoardingEndsCheckIn';
import { isNight, relayedRecently, type FeedPhrase } from '@/shared/backend/rules';
import { promptSignIn } from '@/features/auth/promptSignIn';
import { PlaceResults } from '@/features/search/PlaceResults';
import { usePlaceMatches, useSearchablePlaces } from '@/features/search/useSearchablePlaces';
import { useRoutesVehicles } from '@/features/vehicles/useRoutesVehicles';
import { DEMO_BEACON_RANGE_M, ENERGY_FEED_REPORT, ENERGY_LIVE_REPORT, ENERGY_UI_VISIBLE, RELAY_SAME_VEHICLE_GAP_H, FEED_PHRASES, MAX_WALK_PER_LEG_M, RELAY_BEACON_WAIT_S } from '@/shared/config';
import type { LatLon } from '@/shared/geo/haversine';
import type { LineCoordinates } from '@/shared/geo/line';
import { destinationOptions, nearestDestination, terminalsOf } from '@/shared/relay/broadcast';
import { startQueue } from '@/shared/relay/queue';
import { demoBeacon, relayGate, type DemoMulticab, type RelayBeacon, type RelayGate, type RelayVehicle } from '@/shared/relay/gate';
import type { SearchablePlace } from '@/shared/routing/placeSearch';
import type { RouteStop } from '@/shared/routing/types';
import type { SeatTier } from '@/shared/telemetry/occupancy';
import { reportMockLocation } from '@/services/risk';
import { useConnectionStore } from '@/state/connectionStore';
import { useLocationStore } from '@/state/locationStore';
import { useRecentRelaysStore } from '@/state/recentRelaysStore';
import { showDialog } from '@/state/dialogStore';
import { useRelayStore } from '@/state/relayStore';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useUsernameStore } from '@/state/usernameStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

import { BleCard, RelayVehicleCard, ScanningNote } from './BleCard';
import { confirmQueued } from './confirmQueued';
import { useRelayLocation, type RelayLocationState } from './relayLocation';
import { useBleVehicle, type BleState } from './useBleVehicle';
import { blockedBySuspension } from '@/state/moderationStore';

const ICON_SIZE = spacing.md + spacing.xs;
const PANEL_MAX_HEIGHT = '80%';
const SEARCH_ICON = spacing.md + spacing.xs;
const SEAT_TIERS: readonly SeatTier[] = ['green', 'amber', 'red'];
const MS_PER_S = 1000;
// The form's clock, while it waits RELAY_BEACON_WAIT_S for a beacon
const WAIT_TICK_S = 1;
// The greyed-out form
const DISABLED_OPACITY = 0.4;

type ReportSheetProps = {
  // Every route, for the found multicab's colour (and, in demo data, the demo multicabs to hear)
  routes: readonly { code: string; color: string }[];
  // Demo data: the demo multicabs moving on the map, which stand in for beacons
  vehicles: VehiclesRepository;
  // The stops of a route, in route order: the destinations to pick from
  stopsOf: (routeCode: string) => readonly RouteStop[];
  // RL2a: a route's lines (both directions), for the route check
  linesOf: (routeCode: string) => readonly LineCoordinates[];
  // Where the rider is (GPS, or the simulated position); null when unknown
  position: LatLon | null;
  // G0: a fix good enough for a relay (not mocked or stale), or a simulated position. Asked again at
  // Send, so a fix that has gone stale since does not count
  checkGps: () => boolean;
  // RL2a: the live map is open to team accounts only for now (and to everyone in demo data)
  liveMapAllowed: boolean;
  onClose: () => void;
};

// What Bluetooth knows, for the gate (shared/relay/gate)
function beaconOf(ble: BleState): RelayBeacon {
  const { nearby, view } = ble;
  if (!view) return { kind: nearby.status === 'checking' || nearby.status === 'granted' ? 'searching' : 'off' };
  switch (view.kind) {
    case 'starting':
    case 'searching':
      return { kind: 'searching' };
    case 'ambiguous':
      return { kind: 'several' };
    case 'unavailable':
      return { kind: 'off' };
    case 'found':
      return { kind: 'found', vehicle: view.vehicle };
    case 'failed':
      // A code the server does not know; otherwise the check could not be made yet (the card says why)
      return { kind: view.reason === 'beacon_invalid' || view.reason === 'beacon_expired' || view.reason === 'unknown_vehicle' ? 'unregistered' : 'searching' };
  }
}

// The line under the Bluetooth card while the form is greyed out; null when the card says it already
function gateText(gate: RelayGate, demo: boolean): string | null {
  const t = strings.report.gate;
  switch (gate.kind) {
    case 'needs_permission':
      return t.needsPermission;
    case 'location_off':
      return t.locationOff;
    case 'waiting_fix':
      return t.waitingFix;
    case 'no_bluetooth':
      return t.noBluetooth;
    case 'no_beacon':
      return demo ? t.noDemoBeacon(DEMO_BEACON_RANGE_M) : t.noBeacon;
    case 'several':
      return t.several;
    case 'off_route':
      return t.offRoute(gate.routeCode);
    case 'searching':
    case 'ok':
      return null;
  }
}

function GateNotice({ gate, location, demo }: { gate: RelayGate; location: RelayLocationState; demo: boolean }) {
  const styles = useStyles();
  const { typography } = useTheme();
  const text = gateText(gate, demo);
  if (!text) return null;
  const asksLocation = gate.kind === 'needs_permission' || gate.kind === 'location_off';
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <Text style={[typography.bodySm, styles.noticeText]}>{text}</Text>
      {asksLocation ? (
        <Button
          label={location.blocked && gate.kind === 'needs_permission' ? strings.report.gate.openSettings : strings.report.gate.turnOn}
          variant="secondary"
          onPress={location.turnOn}
        />
      ) : null}
    </View>
  );
}

// RP1, B4: the Relay panel over the Live map (D12). RL2a (Emjay's D9 to D11, 2026-10-23): a relay
// needs the phone's location, a multicab beacon the server verifies, and the rider on that
// multicab's route (shared/relay/gate); until then the form is greyed out and says why. Bluetooth
// fills in the route and plate (never the beacon's id); in demo data a moving demo multicab within
// DEMO_BEACON_RANGE_M stands in for the beacon (Emjay, 2026-10-25: no route or multicab pickers).
// Then Seats, "What's happening" (optional), the Destination (required: reaching it ends the relay)
// and one switch, "Show me on the live map" (off by default, remembered). Off, the relay is a
// Crowdsource post naming the nearest stop, with no coordinates; on, the location moves the multicab
// on the live map. Both end by RL1's rules. Unverified until the verification window (V1a).
// DR8: Bluetooth listens while the panel is open (live data only); a check-in on the found
// multicab's route ends.
export function ReportSheet({ routes, vehicles, stopsOf, linesOf, position, checkGps, liveMapAllowed, onClose }: ReportSheetProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  // The panel ends above Android's navigation bar, so the Relay update button is never under it
  const insets = useSafeAreaInsets();
  // PRD 14: a relay is sent over the internet; offline, Send fails, so the panel says so first
  const offline = useConnectionStore((state) => state.online === false);
  const demoData = useSettingsStore((state) => state.demoData);
  // PRD 10.4: Night Mode as the sheet opens
  const [night] = useState(() => isNight(Date.now()));
  const liveMapSaved = useSettingsStore((state) => state.relayLiveMap);
  const setLiveMapSaved = useSettingsStore((state) => state.setRelayLiveMap);
  const location = useRelayLocation();
  // RK1: a mock (fake GPS) fix is refused for a relay; the server hears of it once per app session
  const mocked = useLocationStore((state) => state.fix?.mocked === true);
  useEffect(() => {
    if (mocked) reportMockLocation();
  }, [mocked]);
  const ble = useBleVehicle(!demoData);
  const found = ble.view?.kind === 'found' ? ble.view : null;
  const [openedMs] = useState(Date.now);
  const [nowMs, setNowMs] = useState(Date.now);
  // Demo data: the demo multicab heard, kept while the form is open (the rider rides with it)
  const [demoFound, setDemoFound] = useState<RelayVehicle | null>(null);
  const [seatTier, setSeatTier] = useState<SeatTier | null>(null);
  const [phrase, setPhrase] = useState<FeedPhrase | null>(null);
  const [destinationCode, setDestinationCode] = useState<string | null>(null);
  // ST2-D2: the destination is typed and searched like From and To in My Rides (stops, buildings,
  // barangays, streets; not the saved places). A place that is not a stop becomes the route's stop
  // nearest to it, shown as "SM City Butuan · get off at SMB".
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [destinationLabel, setDestinationLabel] = useState<string | null>(null);
  const [searchIssue, setSearchIssue] = useState<string | null>(null);
  const searchable = useSearchablePlaces({ saved: false });
  const matches = usePlaceMatches(query, searching, searchable);
  const enqueue = useRelayStore((store) => store.enqueue);
  const signedOut = useSessionStore((state) => state.status !== 'signed-in');
  const username = useUsernameStore((state) => state.username);

  const routeCodes = useMemo(() => routes.map((option) => option.code), [routes]);
  // The demo beacon hears every demo multicab, also those Night Mode hides on the map
  const beaconFleet = useMemo<VehiclesRepository>(() => (vehicles.subscribeAll ? { ...vehicles, subscribe: vehicles.subscribeAll } : vehicles), [vehicles]);
  const demoFleet = useRoutesVehicles(beaconFleet, routeCodes, !demoData || demoFound !== null);
  const multicabs = useMemo<DemoMulticab[]>(
    () => demoFleet.vehicles.map(({ id, label, routeCode, lat, lon }) => ({ id, label, routeCode, lat, lon })),
    [demoFleet.vehicles],
  );
  const beacon: RelayBeacon = demoData
    ? demoFound
      ? { kind: 'found', vehicle: demoFound }
      : demoBeacon(position, multicabs, openedMs, nowMs)
    : beaconOf(ble);
  // Kept from the first time it is heard (set while rendering, so it shows in the same frame)
  if (demoData && !demoFound && beacon.kind === 'found') setDemoFound(beacon.vehicle);
  const gate = relayGate({
    location: location.status,
    fixOk: checkGps(),
    position,
    beacon,
    openedMs,
    nowMs,
    routeOf: (code) => ({ lines: linesOf(code), stops: stopsOf(code) }),
  });
  const vehicle = gate.kind === 'ok' ? gate.vehicle : null;
  useBoardingEndsCheckIn(vehicle);

  // Count the seconds only while waiting for a beacon, so "no registered multicab" shows on time
  const waitingForBeacon = beacon.kind === 'searching' && nowMs - openedMs < RELAY_BEACON_WAIT_S * MS_PER_S;
  useEffect(() => {
    if (!waitingForBeacon) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), WAIT_TICK_S * MS_PER_S);
    return () => clearInterval(timer);
  }, [waitingForBeacon]);

  // The beacon decides the route (or the demo pick)
  const route = vehicle?.routeCode ?? null;
  const destinations = useMemo(() => (route ? destinationOptions(stopsOf(route), position) : []), [route, stopsOf, position]);
  const destination = destinations.find((stop) => stop.code === destinationCode) ?? null;
  const chooseDestination = (place: SearchablePlace) => {
    const stop = destinations.find((candidate) => candidate.code === place.code) ?? nearestDestination(destinations, place, MAX_WALK_PER_LEG_M);
    if (!stop) {
      setSearchIssue(route ? strings.report.destinationTooFar(route, place.title) : strings.report.destinationNone);
      return;
    }
    setDestinationCode(stop.code);
    setDestinationLabel(stop.code === place.code ? stop.name : strings.report.destinationNear(place.title, stop.code));
    setSearchIssue(null);
    setSearching(false);
    setQuery('');
  };
  const clearDestination = () => {
    setDestinationCode(null);
    setDestinationLabel(null);
    setSearchIssue(null);
  };

  // The saved choice stays as it is when the live map is not open to this account
  const liveMap = liveMapSaved && liveMapAllowed;
  const open = vehicle !== null;
  // RL2b: this phone relayed the multicab within RELAY_SAME_VEHICLE_GAP_H; the server decides too
  const recentRelays = useRecentRelaysStore((state) => state.relays);
  const sameVehicle = vehicle !== null && relayedRecently(recentRelays, vehicle.vehicleId, openedMs);
  const ready = open && seatTier !== null && destination !== null && !sameVehicle;

  // RL2c (D12): Send queues the relay on the phone; it is sent once the multicab moves off with the
  // rider in it (useRelayQueue), with the stop nearest the rider then (D11)
  const send = () => {
    if (!vehicle || !seatTier || !destination) return;
    // MOD1b: a suspended rider is told why (live data only)
    if (!demoData && blockedBySuspension()) return;
    if (!checkGps() || !position) {
      showDialog({ tone: 'warning', title: strings.report.failedTitle, body: strings.report.gate.waitingFix });
      return;
    }
    if (!demoData && signedOut) {
      onClose();
      promptSignIn();
      return;
    }
    if (!username) {
      showDialog({
        tone: 'warning',
        title: strings.report.failedTitle,
        body: strings.report.noUsername,
        actions: [
          { label: strings.report.openProfile, onPress: () => router.push('/profile') },
          { label: strings.common.close, variant: 'secondary' },
        ],
      });
      return;
    }
    const nowMs = Date.now();
    enqueue({
      queue: startQueue(vehicle.routeCode, { lat: position.lat, lon: position.lon }, nowMs),
      input: { phrase, seatTier, stopCode: null, withGps: true, liveMap },
      session: {
        mode: liveMap ? 'live' : 'feed',
        seatTier,
        destination: { code: destination.code, name: destination.name, lat: destination.lat, lon: destination.lon },
        startPoint: { lat: position.lat, lon: position.lon },
        terminals: terminalsOf(stopsOf(vehicle.routeCode)),
      },
      vehicleId: vehicle.vehicleId,
      demo: demoData,
    });
    onClose();
    void confirmQueued(destination.name, vehicle.routeCode);
  };

  const colorOf = (code: string | undefined) => routes.find((option) => option.code === code)?.color ?? colors.primary;
  const liveMapHint = !liveMapAllowed
    ? strings.report.liveMapTeamOnly
    : liveMap
      ? ENERGY_UI_VISIBLE
        ? strings.report.liveMapEarns(ENERGY_LIVE_REPORT)
        : strings.report.liveMapShares
      : ENERGY_UI_VISIBLE
        ? strings.report.feedEarns(ENERGY_FEED_REPORT)
        : strings.report.feedOnly;

  return (
    <Animated.View style={styles.backdrop} entering={FadeIn.duration(motion.dialogMs)}>
      <Pressable style={styles.grow} onPress={onClose} accessibilityLabel={strings.report.close} />
      <Animated.View style={[styles.panel, { paddingBottom: spacing.md + insets.bottom }]} entering={SlideInDown.duration(motion.cardMs)}>
        <View style={styles.head}>
          <Text style={[typography.headlineSm, styles.grow]} accessibilityRole="header">
            {strings.report.title}
          </Text>
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={strings.report.close}>
            <X color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {offline ? (
            <View style={styles.notice} accessibilityRole="alert">
              <Text style={[typography.bodySm, styles.noticeText]}>{strings.report.offline}</Text>
            </View>
          ) : null}
          {demoData ? (
            beacon.kind === 'found' ? (
              <RelayVehicleCard vehicle={beacon.vehicle} routeColor={colorOf(beacon.vehicle.routeCode)} demo />
            ) : position ? (
              <ScanningNote />
            ) : null
          ) : (
            <BleCard ble={ble} routeColor={colorOf(found?.vehicle.routeCode)} />
          )}
          <GateNotice gate={gate} location={location} demo={demoData} />

          <View style={[styles.form, open ? null : styles.disabled]} pointerEvents={open ? 'auto' : 'none'} accessibilityState={{ disabled: !open }}>
            <Text style={typography.labelLg}>{strings.report.seats}</Text>
            <View style={styles.chips}>
              {SEAT_TIERS.map((tier) => (
                <Chip key={tier} label={strings.crowdsource.seats[tier]} selected={tier === seatTier} onPress={() => setSeatTier(tier)} />
              ))}
            </View>

            <Text style={typography.labelLg}>{strings.report.whatsHappening}</Text>
            <View style={styles.chips}>
              {FEED_PHRASES.map((value) => (
                <Chip
                  key={value}
                  label={strings.crowdsource.phrases[value]}
                  selected={value === phrase}
                  onPress={() => setPhrase(value === phrase ? null : value)}
                />
              ))}
            </View>

            <Text style={typography.labelLg}>{strings.report.destination}</Text>
            <Text style={typography.bodySm}>{!open || destinations.length > 0 ? strings.report.destinationHint : strings.report.destinationNone}</Text>
            {destination ? (
              <View style={styles.chosen}>
                <MapPin color={colors.primary} size={SEARCH_ICON} />
                <Text style={[typography.labelLg, styles.grow]} numberOfLines={1}>
                  {destinationLabel ?? destination.name}
                </Text>
                <Pressable style={styles.clear} onPress={clearDestination} accessibilityRole="button" accessibilityLabel={strings.report.destinationClear}>
                  <X color={colors.textSecondary} size={SEARCH_ICON} />
                </Pressable>
              </View>
            ) : !open || destinations.length > 0 ? (
              <>
                <View style={styles.searchBox}>
                  <Search color={colors.textSecondary} size={SEARCH_ICON} />
                  <TextInput
                    style={[typography.bodyLg, styles.searchInput]}
                    value={query}
                    onChangeText={(text) => {
                      setQuery(text);
                      setSearchIssue(null);
                    }}
                    onFocus={() => setSearching(true)}
                    onSubmitEditing={() => (matches[0] ? chooseDestination(matches[0]) : undefined)}
                    placeholder={strings.report.destinationSearch}
                    placeholderTextColor={colors.textTertiary}
                    autoCorrect={false}
                    editable={open}
                    returnKeyType="search"
                    accessibilityLabel={strings.report.destinationSearch}
                  />
                </View>
                {searchIssue ? <Text style={[typography.bodySm, styles.issue]}>{searchIssue}</Text> : null}
                {searching && open ? <PlaceResults matches={matches} query={query} onChoose={chooseDestination} /> : null}
              </>
            ) : null}

            <View style={styles.gpsRow}>
              <View style={styles.grow}>
                <Text style={typography.labelLg}>{strings.report.liveMap}</Text>
                <Text style={typography.bodySm}>{liveMapHint}</Text>
                {/* PRD 10.4: at night the relay still counts, but the map shows passed stops only */}
                {liveMap && liveMapAllowed && night ? <Text style={[typography.bodySm, styles.night]}>{strings.report.liveMapNight}</Text> : null}
              </View>
              <Switch value={liveMap} onValueChange={setLiveMapSaved} disabled={!liveMapAllowed} accessibilityLabel={strings.report.liveMap} />
            </View>
            <Text style={typography.bodySm}>{strings.report.unverified}</Text>
          </View>

          {sameVehicle ? (
            <Text style={[typography.bodySm, styles.night]}>
              {strings.report.sameVehicle} {strings.report.sameVehicleBody(RELAY_SAME_VEHICLE_GAP_H)}
            </Text>
          ) : null}
          <Button label={strings.report.send} onPress={send} disabled={!ready} />
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  // ST2-D2: the destination search and the destination chosen
  searchBox: {
    minHeight: MIN_TOUCH_TARGET + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
  },
  chosen: {
    minHeight: MIN_TOUCH_TARGET + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  clear: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  issue: {
    color: colors.warning,
  },
  // RL2a: the form below the gate, greyed out until the gate passes
  form: {
    gap: spacing.sm,
  },
  disabled: {
    opacity: DISABLED_OPACITY,
  },
  notice: {
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surfaceLow,
  },
  noticeText: {
    color: colors.textPrimary,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
  },
  grow: {
    flex: 1,
  },
  panel: {
    maxHeight: PANEL_MAX_HEIGHT,
    paddingBottom: spacing.md,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    paddingTop: spacing.sm,
  },
  close: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  night: {
    color: colors.primary,
  },
  gpsRow: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
}));

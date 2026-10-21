import { router } from 'expo-router';
import { Bluetooth, MapPin, Search, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Button, Chip, IconTile, LineBadge, RouteChip } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import type { FeedPhrase } from '@/shared/backend/rules';
import { promptSignIn } from '@/features/auth/promptSignIn';
import { PlaceResults } from '@/features/search/PlaceResults';
import { usePlaceMatches, useSearchablePlaces } from '@/features/search/useSearchablePlaces';
import { ENERGY_GPS_REPORT, ENERGY_NO_GPS_REPORT, ENERGY_UI_VISIBLE, FEED_LIFETIME_MIN, FEED_PHRASES, MAX_WALK_PER_LEG_M } from '@/shared/config';
import type { LatLon } from '@/shared/geo/haversine';
import { destinationOptions, nearestDestination, relayStopCode } from '@/shared/relay/broadcast';
import type { SearchablePlace } from '@/shared/routing/placeSearch';
import type { RouteStop } from '@/shared/routing/types';
import type { SeatTier } from '@/shared/telemetry/occupancy';
import { sendReport } from '@/state/crowdStore';
import { showDialog } from '@/state/dialogStore';
import { useRelayStore } from '@/state/relayStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

import { useBleVehicle } from './useBleVehicle';
import { useVehicleChoices } from './useVehicleChoices';

const ICON_SIZE = spacing.md + spacing.xs;
const PANEL_MAX_HEIGHT = '80%';
const SEARCH_ICON = spacing.md + spacing.xs;
const SEAT_TIERS: readonly SeatTier[] = ['green', 'amber', 'red'];

type ReportSheetProps = {
  routes: readonly { code: string; color: string }[];
  initialRoute: string | null;
  // T1: the manual vehicle picker (D5, unverified): team accounts on live data pick the multicab,
  // whose marker their location then moves
  vehiclePicker: boolean;
  // The stops of a route, in route order: the destinations to pick from
  stopsOf: (routeCode: string) => readonly RouteStop[];
  // Where the rider is, to leave out the stop they are at; null when unknown
  position: LatLon | null;
  // A good GPS fix or a simulated stop: the report may go "with GPS"
  gpsAvailable: boolean;
  // G0: asked again at Send, so a fix that has gone stale (or turned mock) since does not count
  checkGps: () => boolean;
  onClose: () => void;
};

// RP1, B4: the Relay panel over the Live map (D12). The vehicle (from Bluetooth when it hears one,
// else picked by hand), then Seats, "What's happening" (optional), the Destination and the GPS
// switch. Fixed fields only (D2). Sent with GPS, the rider's location is shared on the live map
// until they reach the destination, which ends it. Earns Energy (with GPS 1.0, without 0.5; each
// once a Manila day). Unverified until Bluetooth (D5).
export function ReportSheet({ routes, initialRoute, vehiclePicker, stopsOf, position, gpsAvailable, checkGps, onClose }: ReportSheetProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const ble = useBleVehicle();
  const { stops } = useRouteData();
  const [pickedRoute, setRoute] = useState<string | null>(initialRoute ?? routes[0]?.code ?? null);
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
  const [pickedVehicle, setVehicleId] = useState<string | null>(null);
  const [withGps, setWithGps] = useState(gpsAvailable);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const startBroadcast = useRelayStore((store) => store.start);

  // Bluetooth, when it hears the multicab, decides the route and the vehicle
  const route = ble?.routeCode ?? pickedRoute;
  const vehicles = useVehicleChoices(ble ? null : route, vehiclePicker);
  // A multicab picked on another route does not count
  const vehicleId = ble?.vehicleId ?? (vehicles.some((vehicle) => vehicle.id === pickedVehicle) ? pickedVehicle : null);
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

  // Sharing GPS needs a destination: reaching it is what ends the sharing
  const gpsPossible = gpsAvailable && destination !== null;
  const gps = withGps && gpsPossible;
  const ready = route !== null && seatTier !== null && !sending;

  const send = async () => {
    if (!route || !seatTier || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      // B6: the nearest stop goes with every relay, GPS or not, as a code only
      const stopCode = relayStopCode(stops, position);
      const sendGps = gps && checkGps();
      const result = await sendReport({ routeCode: route, phrase, seatTier, vehicleId, stopCode, withGps: sendGps });
      if (result.ok) {
        onClose();
        if (sendGps && destination) {
          startBroadcast({
            routeCode: route,
            vehicleId,
            seatTier,
            destination: { code: destination.code, name: destination.name, lat: destination.lat, lon: destination.lon },
            startedMs: Date.now(),
          });
        }
        showDialog({
          tone: 'success',
          title: strings.report.sentTitle,
          body: sendGps && destination ? strings.report.sentBodyGps(destination.name) : strings.report.sentBody(FEED_LIFETIME_MIN),
        });
      } else if (result.reason === 'sign_in') {
        onClose();
        promptSignIn();
      } else if (result.reason === 'no_username') {
        showDialog({
          tone: 'warning',
          title: strings.report.failedTitle,
          body: strings.report.noUsername,
          actions: [
            { label: strings.report.openProfile, onPress: () => router.push('/profile') },
            { label: strings.common.close, variant: 'secondary' },
          ],
        });
      } else {
        showDialog({ tone: 'danger', title: strings.report.failedTitle, body: result.message ?? strings.report.failedBody });
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const bleColor = routes.find((option) => option.code === ble?.routeCode)?.color ?? colors.primary;

  return (
    <Animated.View style={styles.backdrop} entering={FadeIn.duration(motion.dialogMs)}>
      <Pressable style={styles.grow} onPress={onClose} accessibilityLabel={strings.report.close} />
      <Animated.View style={styles.panel} entering={SlideInDown.duration(motion.cardMs)}>
        <View style={styles.head}>
          <Text style={[typography.headlineSm, styles.grow]} accessibilityRole="header">
            {strings.report.title}
          </Text>
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={strings.report.close}>
            <X color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {ble ? (
            // B4 slot: the vehicle heard over Bluetooth replaces the manual pickers
            <View style={styles.ble} accessible accessibilityLabel={strings.report.bleLabel(ble.routeCode, ble.plate)}>
              <IconTile icon={Bluetooth} />
              <View style={styles.grow}>
                <Text style={typography.labelLg}>{strings.report.bleTitle}</Text>
                <Text style={typography.bodySm}>{strings.report.bleBody}</Text>
              </View>
              <LineBadge code={ble.routeCode} color={bleColor} />
              <Text style={typography.labelLg}>{ble.plate}</Text>
            </View>
          ) : (
            <>
              <Text style={typography.labelLg}>{strings.report.route}</Text>
              <View style={styles.chips}>
                {routes.map((option) => (
                  <RouteChip
                    key={option.code}
                    code={option.code}
                    color={option.color}
                    selected={option.code === route}
                    onPress={() => setRoute(option.code)}
                    accessibilityLabel={strings.live.routeChip(option.code, option.code === route)}
                  />
                ))}
              </View>
              {vehicles.length > 0 ? (
                <>
                  <Text style={typography.labelLg}>{strings.report.vehicle}</Text>
                  <Text style={typography.bodySm}>{strings.report.vehicleHint}</Text>
                  <View style={styles.chips}>
                    {vehicles.map((vehicle) => (
                      <Chip
                        key={vehicle.id}
                        label={vehicle.label}
                        selected={vehicle.id === vehicleId}
                        onPress={() => setVehicleId(vehicle.id === vehicleId ? null : vehicle.id)}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}

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
          <Text style={typography.bodySm}>{destinations.length > 0 ? strings.report.destinationHint : strings.report.destinationNone}</Text>
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
          ) : destinations.length > 0 ? (
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
                  returnKeyType="search"
                  accessibilityLabel={strings.report.destinationSearch}
                />
              </View>
              {searchIssue ? <Text style={[typography.bodySm, styles.issue]}>{searchIssue}</Text> : null}
              {searching ? <PlaceResults matches={matches} query={query} onChoose={chooseDestination} /> : null}
            </>
          ) : null}

          <View style={styles.gpsRow}>
            <View style={styles.grow}>
              <Text style={typography.labelLg}>{strings.report.withGps}</Text>
              <Text style={typography.bodySm}>
                {!gpsAvailable
                  ? ENERGY_UI_VISIBLE
                    ? strings.report.gpsUnavailable(ENERGY_NO_GPS_REPORT)
                    : strings.report.gpsUnavailableFree
                  : destination
                    ? ENERGY_UI_VISIBLE
                      ? strings.report.gpsEarns(ENERGY_GPS_REPORT, ENERGY_NO_GPS_REPORT)
                      : strings.report.gpsShares
                    : strings.report.gpsNeedsDestination}
              </Text>
            </View>
            <Switch value={gps} onValueChange={setWithGps} disabled={!gpsPossible} accessibilityLabel={strings.report.withGps} />
          </View>
          <Text style={typography.bodySm}>{strings.report.unverified}</Text>

          <Button label={sending ? strings.report.sending : strings.report.send} onPress={() => void send()} disabled={!ready} />
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  ble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  gpsRow: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
}));

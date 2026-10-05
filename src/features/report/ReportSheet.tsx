import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Button, Chip, RouteChip } from '@/components';
import type { FeedPhrase } from '@/shared/backend/rules';
import { ENERGY_GPS_REPORT, ENERGY_NO_GPS_REPORT, FEED_LIFETIME_MIN, FEED_PHRASES } from '@/shared/config';
import type { SeatTier } from '@/shared/telemetry/occupancy';
import { sendReport } from '@/state/crowdStore';
import { showDialog } from '@/state/dialogStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;
const PANEL_MAX_HEIGHT = '80%';
const SEAT_TIERS: readonly SeatTier[] = ['green', 'amber', 'red'];

type ReportSheetProps = {
  routes: readonly { code: string; color: string }[];
  initialRoute: string | null;
  // The manual vehicle picker (D5): only in development builds, and only database vehicles
  vehicles: readonly { id: string; label: string }[];
  // A good GPS fix or a simulated stop: the report may go "with GPS"
  gpsAvailable: boolean;
  onClose: () => void;
};

// RP1: the Report panel over the Live map (D12). Fixed fields only (D2): route, one preset phrase,
// an optional seat tier, with or without GPS. The report goes to the feed for FEED_LIFETIME_MIN and
// earns Energy (with GPS 1.0, without 0.5; each once a Manila day). Unverified until Bluetooth (D5).
export function ReportSheet({ routes, initialRoute, vehicles, gpsAvailable, onClose }: ReportSheetProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const [route, setRoute] = useState<string | null>(initialRoute ?? routes[0]?.code ?? null);
  const [phrase, setPhrase] = useState<FeedPhrase | null>(null);
  const [seatTier, setSeatTier] = useState<SeatTier | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [withGps, setWithGps] = useState(gpsAvailable);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  const gps = withGps && gpsAvailable;
  const ready = route !== null && phrase !== null && !sending;

  const send = async () => {
    if (!route || !phrase || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const result = await sendReport({ routeCode: route, phrase, seatTier, vehicleId, withGps: gps });
      if (result.ok) {
        onClose();
        showDialog({ tone: 'success', title: strings.report.sentTitle, body: gps ? strings.report.sentBodyGps : strings.report.sentBody(FEED_LIFETIME_MIN) });
      } else if (result.reason === 'sign_in') {
        onClose();
        router.push('/sign-in');
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
        <ScrollView contentContainerStyle={styles.body}>
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

          <Text style={typography.labelLg}>{strings.report.whatsHappening}</Text>
          <View style={styles.chips}>
            {FEED_PHRASES.map((value) => (
              <Chip key={value} label={strings.crowdsource.phrases[value]} selected={value === phrase} onPress={() => setPhrase(value)} />
            ))}
          </View>

          <Text style={typography.labelLg}>{strings.report.seats}</Text>
          <View style={styles.chips}>
            {SEAT_TIERS.map((tier) => (
              <Chip
                key={tier}
                label={strings.crowdsource.seats[tier]}
                selected={tier === seatTier}
                onPress={() => setSeatTier(tier === seatTier ? null : tier)}
              />
            ))}
          </View>

          {__DEV__ && vehicles.length > 0 ? (
            <>
              <Text style={typography.labelLg}>{strings.report.vehicleDev}</Text>
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

          <View style={styles.gpsRow}>
            <View style={styles.grow}>
              <Text style={typography.labelLg}>{strings.report.withGps}</Text>
              <Text style={typography.bodySm}>
                {gpsAvailable ? strings.report.gpsEarns(ENERGY_GPS_REPORT, ENERGY_NO_GPS_REPORT) : strings.report.gpsUnavailable(ENERGY_NO_GPS_REPORT)}
              </Text>
            </View>
            <Switch
              value={gps}
              onValueChange={setWithGps}
              disabled={!gpsAvailable}
              accessibilityLabel={strings.report.withGps}
            />
          </View>
          <Text style={typography.bodySm}>{strings.report.unverified}</Text>

          <Button label={sending ? strings.report.sending : strings.report.send} onPress={() => void send()} disabled={!ready} />
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
  gpsRow: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
}));

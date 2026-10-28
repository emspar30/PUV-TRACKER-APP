import { Bus, Crosshair, MapPin, MapPinOff, Navigation, Radio, ShieldAlert, Users, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Button, IconTile, StatusPill } from '@/components';
import { VEHICLE_CAPACITY_SEATS } from '@/shared/config';
import { ageSeconds } from '@/shared/telemetry/coverage';
import { seatTier } from '@/shared/telemetry/occupancy';
import type { VehicleSnapshot } from '@/shared/telemetry/vehicle';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

type VehicleCardProps = {
  vehicle: VehicleSnapshot;
  nowMs: number;
  // Stop code ahead of the vehicle, or null at the end of its line
  nextStop: string | null;
  stopped: boolean;
  // How far the vehicle is from the commuter (PRD 7.4), or null without a position
  distanceKm: number | null;
  onTrack: () => void;
  // No phone location and no simulated one: Track is greyed out, with a button that turns it on
  // (Emjay, 2026-10-26)
  locationOff?: boolean;
  onTurnOnLocation?: () => void;
  // CF1: drawn at an estimated position (silent 90 s to 5 minutes)
  estimated?: boolean;
  onClose: () => void;
};

const ICON_SIZE = spacing.md + spacing.xs;
const SMALL_ICON = spacing.md;

// The tapped multicab (restyle): route and plate, next stop, free seats, how fresh the position is
// and how far from the commuter (PRD 7.4, "Seen 40 s ago, 1.4 km from you"). The ETA shows only
// after Track opens the tracking panel (L2; Emjay, 2026-10-24). A live vehicle the server has not
// verified says "Prototype data, unverified" (PRD 0.7).
export function VehicleCard({ vehicle, nowMs, nextStop, stopped, distanceKm, onTrack, locationOff = false, onTurnOnLocation, estimated = false, onClose }: VehicleCardProps) {
  const styles = useStyles();
  const { colors, typography, mapPaint, elevation } = useTheme();
  const free = Math.max(0, VEHICLE_CAPACITY_SEATS - vehicle.seatsTaken);
  const tier = seatTier(vehicle.seatsTaken);
  const tierColor = { green: mapPaint.occupancyGreen, amber: mapPaint.occupancyAmber, red: mapPaint.occupancyRed }[tier];
  const age = strings.live.vehicle.ageSeconds(ageSeconds(vehicle.lastPacketMs, nowMs));
  return (
    <View style={[styles.card, elevation.level3]}>
      <View style={styles.head}>
        <IconTile icon={Bus} />
        <View style={styles.grow}>
          <View style={styles.titleRow}>
            <Text style={typography.labelLg}>{strings.live.vehicle.route(vehicle.routeCode)}</Text>
            <View style={styles.plate}>
              <Text style={typography.labelSm}>{vehicle.label}</Text>
            </View>
          </View>
          {nextStop ? <Text style={typography.bodySm}>{strings.live.vehicle.next(nextStop)}</Text> : null}
        </View>
        {stopped ?<StatusPill label={strings.live.vehicle.stopped} tone="warning" /> : null}
        <Pressable style={styles.icon} onPress={onClose} accessibilityRole="button" accessibilityLabel={strings.live.vehicle.close}>
          <X color={colors.textSecondary} size={ICON_SIZE} />
        </Pressable>
      </View>
      <View style={styles.facts}>
        <View style={styles.fact}>
          <View style={[styles.dot, { backgroundColor: tierColor }]} />
          <Users color={colors.textSecondary} size={SMALL_ICON} />
          <Text style={typography.bodySm}>{strings.live.vehicle.seats(free, vehicle.seatsTaken, VEHICLE_CAPACITY_SEATS)}</Text>
        </View>
        <View style={styles.fact}>
          <Radio color={vehicle.demo ? colors.textSecondary : colors.success} size={SMALL_ICON} />
          <Text style={typography.bodySm}>{vehicle.demo ? strings.live.vehicle.demo(age) : strings.live.vehicle.liveGps(age)}</Text>
        </View>
        {estimated ? (
          <View style={styles.fact}>
            <Navigation color={colors.textSecondary} size={SMALL_ICON} />
            <Text style={typography.bodySm}>{strings.live.vehicle.estimated}</Text>
          </View>
        ) : null}
        {distanceKm !== null ? (
          <View style={styles.fact}>
            <MapPin color={colors.textSecondary} size={SMALL_ICON} />
            <Text style={typography.bodySm}>{strings.live.vehicle.fromYou(distanceKm)}</Text>
          </View>
        ) : null}
        {!vehicle.demo && vehicle.verified !== true ? (
          <View style={styles.fact}>
            <ShieldAlert color={colors.warning} size={SMALL_ICON} />
            <Text style={typography.bodySm}>{strings.live.vehicle.unverified}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.track}>
        <Button label={strings.live.vehicle.track} leadingIcon={Crosshair} onPress={onTrack} disabled={locationOff} />
        {locationOff && onTurnOnLocation ? (
          <Button label={strings.live.tracking.turnOnToTrack} leadingIcon={MapPinOff} variant="text" onPress={onTurnOnLocation} />
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    gap: spacing.sm + spacing.xs,
    padding: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  grow: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  plate: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.badge,
    backgroundColor: colors.surface,
  },
  icon: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    marginRight: spacing.sm + spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLow,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  track: {
    gap: spacing.xs,
    marginRight: spacing.sm + spacing.xs,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.sm,
  },
}));

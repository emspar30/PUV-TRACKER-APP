import { ChevronDown, ChevronUp, RadioTower } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Button, IconTile } from '@/components';
import { LIVE_UI_REFRESH_INTERVAL_S } from '@/shared/config';
import type { LatLon } from '@/shared/geo/haversine';
import type { LineCoordinates } from '@/shared/geo/line';
import type { RelayBroadcast } from '@/shared/relay/broadcast';
import { arrivalLeftS } from '@/shared/relay/limits';
import { relayProgress } from '@/shared/relay/progress';
import { useRelayStore } from '@/state/relayStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

import type { UplinkStatus } from './useGpsBroadcast';

const MS_PER_S = 1000;
// RL1: the arrival countdown counts down every second
const COUNTDOWN_TICK_S = 1;
const METERS_PER_KM = 1000;
const ICON_SIZE = spacing.md + spacing.xs;
const BAR_HEIGHT = spacing.sm;
const PERCENT = 100;

type RelayBarProps = {
  session: RelayBroadcast;
  // The rider's position and speed, and the route's lines (both directions)
  position: LatLon | null;
  speedKmh: number | null;
  lines: readonly LineCoordinates[];
  // T1: whether the location reaches the live map
  uplink: UplinkStatus;
  onStop: () => void;
};

function uplinkText(uplink: UplinkStatus, nowMs: number): string {
  const t = strings.report.uplink;
  switch (uplink.kind) {
    case 'noVehicle':
      return t.noVehicle;
    case 'offTeam':
      return t.offTeam;
    case 'waiting':
      return t.waiting;
    case 'live':
      return t.live(Math.max(0, Math.round((nowMs - uplink.sentMs) / MS_PER_S)));
    case 'saved':
      return t.saved(uplink.count);
  }
}

const distance = (meters: number) => (meters < METERS_PER_KM ? strings.format.meters(meters) : strings.format.km(meters / METERS_PER_KM));

// B4: shown on the Map while a relay shares the rider's location; it ends by itself at the
// destination. CA1.1: a tap opens the relay's details: how far to the destination, how much of the
// ride is done, about how long is left, how long it has been shared, and the multicab and seats.
// RL1: at the destination it counts down the seconds until sharing stops.
export function RelayBar({ session, position, speedKmh, lines, uplink, onStop }: RelayBarProps) {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  const t = strings.report;
  const [nowMs, setNowMs] = useState(Date.now);
  const [open, setOpen] = useState(false);
  const live = uplink.kind === 'live';
  const watch = useRelayStore((store) => store.watch);
  const arriving = watch.arrivingSinceMs !== null;

  // "sent 10 s ago" counts up while the marker is live; the details keep their times current
  useEffect(() => {
    if (!live && !open && !arriving) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), (arriving ? COUNTDOWN_TICK_S : LIVE_UI_REFRESH_INTERVAL_S) * MS_PER_S);
    return () => clearInterval(timer);
  }, [live, open, arriving]);

  const progress = relayProgress({ session, position, lines, speedKmh, capFromMs: watch.capFromMs, nowMs: Math.max(nowMs, session.startedMs) });
  const leftS = arrivalLeftS(watch, Math.max(nowMs, watch.arrivingSinceMs ?? 0));
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <View style={[styles.card, elevation.level3]} accessibilityLiveRegion="polite">
      <View style={styles.bar}>
        <Pressable
          style={styles.summary}
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? t.info.hide : t.info.show}
        >
          <IconTile icon={RadioTower} tone={uplink.kind === 'saved' ? 'warning' : 'success'} />
          <View style={styles.grow}>
            <Text style={typography.labelLg} numberOfLines={1}>
              {t.sharingTitle}
            </Text>
            <Text style={typography.bodySm} numberOfLines={1}>
              {leftS !== null
                ? t.arriving(session.destination.name, leftS)
                : progress.leftM !== null
                  ? t.info.left(distance(progress.leftM), session.destination.name)
                  : t.sharingDetail(session.routeCode, session.destination.name)}
            </Text>
            <Text style={typography.bodySm} numberOfLines={1}>
              {uplinkText(uplink, Math.max(nowMs, live ? uplink.sentMs : 0))}
            </Text>
          </View>
          <Chevron color={colors.textSecondary} size={ICON_SIZE} />
        </Pressable>
        <Button label={t.stopSharing} variant="secondary" onPress={onStop} />
      </View>
      {open ? (
        <Animated.View style={styles.details} entering={FadeIn.duration(motion.cardMs)} exiting={FadeOut.duration(motion.dialogMs)}>
          {progress.done !== null ? (
            <View
              style={styles.track}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t.info.doneLabel}
              accessibilityValue={{ min: 0, max: PERCENT, now: Math.round(progress.done * PERCENT) }}
            >
              <View style={[styles.fill, { width: `${Math.round(progress.done * PERCENT)}%` }]} />
            </View>
          ) : null}
          <Text style={typography.bodyMd}>
            {progress.leftM !== null ? t.info.toGo(distance(progress.leftM), progress.byRoad, progress.etaMin) : t.info.noPosition}
          </Text>
          <Text style={typography.bodySm}>{t.info.route(session.routeCode, session.destination.name)}</Text>
          <Text style={typography.bodySm}>
            {t.info.multicab(session.vehicleId, strings.crowdsource.seats[session.seatTier])}
          </Text>
          <Text style={typography.bodySm}>{t.info.shared(progress.sharedMin, progress.askInMin)}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    padding: spacing.sm + spacing.xs,
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summary: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  grow: {
    flex: 1,
  },
  details: {
    gap: spacing.xs,
  },
  track: {
    height: BAR_HEIGHT,
    marginBottom: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fill: {
    height: BAR_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
  },
}));

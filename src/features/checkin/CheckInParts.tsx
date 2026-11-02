import { ChevronUp, Clock, Footprints, Heart, MapPin, Navigation, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button, Chip, IconTile, LineBadge } from '@/components';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md;
const CHEVRON_SIZE = spacing.md + spacing.xs;

// Pieces of the Check-in card (C1 UI pass, B3).

type RoutePingProps = {
  routes: readonly string[];
  picked: readonly string[];
  onChange: (picked: string[]) => void;
  // CA1.1: how many routes the Energy balance pays for; the rest cannot be ticked
  max: number;
};

// A stop served by two or more routes: ping one, some or all of them. Only the picked routes count
// the commuter, so drivers of the other routes get no SMS about them. At least one stays picked.
export function RoutePing({ routes, picked, onChange, max }: RoutePingProps) {
  const styles = useStyles();
  const { typography } = useTheme();
  const all = routes.every((code) => picked.includes(code));
  const full = picked.length >= max;
  const toggle = (code: string) => {
    // Energy for one route only: a tap moves the ping to that route
    if (max === 1 && !picked.includes(code)) return onChange([code]);
    const next = picked.includes(code) ? picked.filter((value) => value !== code) : [...picked, code];
    if (next.length > 0 && next.length <= max) onChange(routes.filter((value) => next.includes(value)));
  };
  return (
    <View style={styles.ping}>
      <View style={styles.between}>
        <Text style={[typography.labelSm, styles.overline]}>{strings.checkin.pingRoutes}</Text>
        <Text style={typography.bodySm}>{strings.checkin.pingHint}</Text>
      </View>
      <View style={styles.chips}>
        <Chip label={strings.checkin.pingAll} selected={all} disabled={routes.length > max} onPress={() => onChange([...routes])} />
        {routes.map((code) => (
          <Chip
            key={code}
            label={code}
            selected={picked.includes(code)}
            disabled={full && max > 1 && !picked.includes(code)}
            onPress={() => toggle(code)}
            accessibilityLabel={strings.checkin.pingLabel(code, picked.includes(code))}
          />
        ))}
      </View>
    </View>
  );
}

type StationCardProps = {
  // "Your location", or "Selected station" for a dot tapped on the map
  overline: string;
  name: string;
  // True for the commuter's own spot, false for a station tapped on the map
  here: boolean;
  // "RCA · 120 m · 2 min walk · 3 waiting", for a tapped station only
  meta?: string;
  // The routes that stop or pass here, with their badge colours
  routesLabel: string;
  routes: readonly { code: string; color: string }[];
  // The Check in button; null where this card cannot check in (a station the commuter is not at)
  checkIn: { label: string; disabled: boolean; onPress: () => void } | null;
  // A tapped station: back to the commuter's own spot
  onBack?: () => void;
  // A tapped station's X: back to the commuter's own spot. The commuter's own card has none.
  onClose?: () => void;
  // The notices and the route ping
  children?: ReactNode;
};

// B3: the commuter's spot or a tapped station, after Google Maps' place sheet: what it is, the
// routes there, then one full-width action
export function StationCard({ overline, name, here, meta, routesLabel, routes, checkIn, onBack, onClose, children }: StationCardProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={styles.inner}>
      <View style={styles.row}>
        <IconTile icon={here ? Navigation : MapPin} />
        <View style={styles.grow}>
          <Text style={[typography.labelSm, styles.overline]}>{overline}</Text>
          <Text style={typography.headlineSm} numberOfLines={2}>
            {name}
          </Text>
          {meta ? (
            <View style={styles.metaRow}>
              <Footprints color={colors.textSecondary} size={ICON_SIZE} />
              {/* Wraps rather than cutting the waiting count off ("2 wai") */}
              <Text style={[typography.bodySm, styles.grow]}>
                {meta}
              </Text>
            </View>
          ) : null}
        </View>
        {onClose ? (
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={strings.checkin.closeStation}>
            <X color={colors.textSecondary} size={CHEVRON_SIZE} />
          </Pressable>
        ) : null}
      </View>
      {routes.length > 0 ? (
        <View style={styles.routesRow} accessible accessibilityLabel={`${routesLabel}: ${routes.map((route) => route.code).join(', ')}`}>
          <Text style={typography.bodySm}>{routesLabel}</Text>
          {routes.map((route) => (
            <LineBadge key={route.code} code={route.code} color={route.color} />
          ))}
        </View>
      ) : null}
      {children}
      {checkIn ? <Button label={strings.checkin.checkIn} onPress={checkIn.onPress} disabled={checkIn.disabled} accessibilityLabel={checkIn.label} /> : null}
      {onBack ? <Button label={strings.checkin.backToMe} leadingIcon={Navigation} variant="secondary" onPress={onBack} /> : null}
    </View>
  );
}

// B3: after "I boarded", a short goodbye in place of the card, then back to the stations
export function FarewellCard({ routes, onDone }: { routes: string; onDone: () => void }) {
  const styles = useStyles();
  const { typography } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(motion.cardMs)} style={styles.farewell} accessibilityLiveRegion="polite">
      <IconTile icon={Heart} tone="success" />
      <Text style={typography.headlineSm} accessibilityRole="header">
        {strings.checkin.farewellTitle}
      </Text>
      <Text style={[typography.bodyMd, styles.center]}>{strings.checkin.farewellBody(routes)}</Text>
      <View style={styles.full}>
        <Button label={strings.checkin.farewellDone} variant="secondary" onPress={onDone} />
      </View>
    </Animated.View>
  );
}

type CompactBarProps = {
  title: string;
  // The running check-in's time left, shown as a green pill
  countdown?: string;
  badges: readonly { code: string; color: string }[];
  onExpand: () => void;
};

// B3: the minimised card, one row; a tap brings the whole card back
export function CompactBar({ title, countdown, badges, onExpand }: CompactBarProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <Pressable style={styles.compact} onPress={onExpand} accessibilityRole="button" accessibilityLabel={strings.checkin.expand}>
      {badges.map((badge) => (
        <LineBadge key={badge.code} code={badge.code} color={badge.color} />
      ))}
      <Text style={[typography.labelLg, styles.grow]} numberOfLines={1}>
        {title}
      </Text>
      {countdown ? (
        <View style={styles.pill}>
          <Clock color={colors.success} size={ICON_SIZE} />
          <Text style={[typography.labelMd, styles.pillText]}>{countdown}</Text>
        </View>
      ) : null}
      <ChevronUp color={colors.textSecondary} size={CHEVRON_SIZE} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ping: {
    gap: spacing.xs + spacing.xs / 2,
  },
  overline: {
    color: colors.primary,
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inner: {
    gap: spacing.sm + spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  routesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  close: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  farewell: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
  full: {
    alignSelf: 'stretch',
  },
  compact: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.successContainer,
  },
  pillText: {
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
}));

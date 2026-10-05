import { ChevronUp, Clock, Footprints, Heart, MapPin, Navigation } from 'lucide-react-native';
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
};

// A stop served by two or more routes: ping one, some or all of them. Only the picked routes count
// the commuter, so drivers of the other routes get no SMS about them. At least one stays picked.
export function RoutePing({ routes, picked, onChange }: RoutePingProps) {
  const styles = useStyles();
  const { typography } = useTheme();
  const all = routes.every((code) => picked.includes(code));
  const toggle = (code: string) => {
    const next = picked.includes(code) ? picked.filter((value) => value !== code) : [...picked, code];
    if (next.length > 0) onChange(routes.filter((value) => next.includes(value)));
  };
  return (
    <View style={styles.ping}>
      <View style={styles.between}>
        <Text style={[typography.labelSm, styles.overline]}>{strings.checkin.pingRoutes}</Text>
        <Text style={typography.bodySm}>{strings.checkin.pingHint}</Text>
      </View>
      <View style={styles.chips}>
        <Chip label={strings.checkin.pingAll} selected={all} onPress={() => onChange([...routes])} />
        {routes.map((code) => (
          <Chip
            key={code}
            label={code}
            selected={picked.includes(code)}
            onPress={() => toggle(code)}
            accessibilityLabel={strings.checkin.pingLabel(code, picked.includes(code))}
          />
        ))}
      </View>
    </View>
  );
}

type StationCardProps = {
  name: string;
  // True for the nearest station, false for one tapped on the map
  nearest: boolean;
  // "RCA · 120 m · 2 min walk · 3 waiting"
  meta: string;
  // The routes that stop here, with their badge colours
  routes: readonly { code: string; color: string }[];
  checkInLabel: string;
  disabled: boolean;
  onCheckIn: () => void;
  // The route ping, at a shared stop
  children?: ReactNode;
};

// B3: the station, after Google Maps' place sheet: what it is and how far, the routes that stop
// there, then one full-width action
export function StationCard({ name, nearest, meta, routes, checkInLabel, disabled, onCheckIn, children }: StationCardProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={styles.inner}>
      <View style={styles.row}>
        <IconTile icon={nearest ? Navigation : MapPin} />
        <View style={styles.grow}>
          <Text style={[typography.labelSm, styles.overline]}>{nearest ? strings.checkin.nearest : strings.checkin.picked}</Text>
          <Text style={typography.headlineSm} numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.metaRow}>
            <Footprints color={colors.textSecondary} size={ICON_SIZE} />
            <Text style={[typography.bodySm, styles.grow]} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.routesRow} accessible accessibilityLabel={`${strings.checkin.routesHere}: ${routes.map((route) => route.code).join(', ')}`}>
        <Text style={typography.bodySm}>{strings.checkin.routesHere}</Text>
        {routes.map((route) => (
          <LineBadge key={route.code} code={route.code} color={route.color} />
        ))}
      </View>
      {children}
      <Button label={strings.checkin.checkIn} onPress={onCheckIn} disabled={disabled} accessibilityLabel={checkInLabel} />
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

import { router, useIsFocused } from 'expo-router';
import { Clock, Flag, MapPin, MessagesSquare, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Chip, LineBadge, SkeletonCard, StatusPill, TopBar } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { useSkeleton } from '@/features/loading/useSkeleton';
import { DEMO_SEED, FEED_FLAG_HIDE_COUNT, SKELETON_LONG_MS } from '@/shared/config';
import { demoFeed, type FeedPost } from '@/shared/demo/feed';
import { flagPost, useCrowd, useFlaggedStore } from '@/state/crowdStore';
import { showDialog } from '@/state/dialogStore';
import { useEnergyStore } from '@/state/energyStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useUsernameStore } from '@/state/usernameStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md;
const EMPTY_ICON = spacing.xl;
const DOT = spacing.sm + spacing.xs / 2;
// A 32 dp Flag button with a 48 dp touch target, so the top row stays low
const FLAG_SIZE = spacing.xl;
const FLAG_HIT_SLOP = (MIN_TOUCH_TARGET - FLAG_SIZE) / 2;
const REFRESH_MS = 30000;
const MS_PER_MIN = 60000;
const STAGGER_MS = 40;
const STAGGER_MAX = 6;

// Crowdsource (restyle, N1, B6): commuter reports from the last hour. With Demo data on, the user's
// own demo reports (RP1) and the made-up feed; with it off, the database feed. Each post is a compact
// card (route, multicab, time, seats, status, the stop it was sent near, the Trusted badge) and, on
// other people's posts, a Flag button: a flagged post is hidden for the user at once, and for
// everyone at FEED_FLAG_HIDE_COUNT flags.
// Reloads when a report is sent (the wallet changes), every REFRESH_MS, and on focus.
export default function CrowdsourceScreen() {
  const styles = useStyles();
  const { colors, typography, routeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const demo = useSettingsStore((state) => state.demoData);
  const { lines, stops } = useRouteData();
  const routeCodes = [...new Set(lines.map((line) => line.routeCode))].sort();
  const [filter, setFilter] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const crowd = useCrowd();
  const wallet = useEnergyStore((state) => state.snapshot);
  const ownName = useUsernameStore((state) => state.username);
  const flagged = useFlaggedStore((state) => state.ids);
  const [loaded, setLoaded] = useState<{ reports: typeof crowd.reports; posts: readonly FeedPost[] | null } | null>(null);

  useEffect(() => {
    if (!focused) return undefined;
    let current = true;
    const load = () => {
      setNowMs(Date.now());
      crowd.reports
        .recent()
        .then((posts) => {
          if (current) setLoaded({ reports: crowd.reports, posts });
        })
        .catch(() => {
          if (current) setLoaded({ reports: crowd.reports, posts: null });
        });
    };
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      current = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [focused, crowd, wallet]);

  const mine = loaded && loaded.reports === crowd.reports ? loaded.posts : null;
  const stopsOf = (code: string) => stops.filter((stop) => stop.routeCodes?.includes(code)).map((stop) => stop.code);
  const posts = demo ? [...(mine ?? []), ...demoFeed(routeCodes, nowMs, DEMO_SEED, stopsOf)] : (mine ?? []);
  // "Near 8-318 M. Calo St": the stop's name up to its first comma, or its code
  const stopNameOf = (code: string | null) => {
    if (!code) return null;
    const name = stops.find((stop) => stop.code === code)?.name;
    return name ? (name.split(',')[0] ?? name) : code;
  };
  // B8: live data loads over the network; the demo shows the same short placeholder
  const loadingFeed = useSkeleton(SKELETON_LONG_MS, !(!demo && crowd.reports.source === 'live' && loaded === null));
  const needsSignIn = !demo && crowd.reports.source === 'live' && loaded !== null && mine === null;
  // Only updates sent without GPS: those with GPS belong to the live map (broadcast and merged)
  const visible = posts.filter((post) => !post.withGps && !flagged.has(post.id));
  const shown = filter ? visible.filter((post) => post.routeCode === filter) : visible;
  const colorOf = (code: string) => {
    const line = lines.find((candidate) => candidate.routeCode === code);
    return line ? routeColor(code, line.color) : colors.primary;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        <TopBar />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.grow}>
            <Text style={typography.headlineMd} accessibilityRole="header">
              {strings.crowdsource.title}
            </Text>
            <Text style={typography.bodySm}>{strings.crowdsource.body}</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip label={strings.crowdsource.all} selected={filter === null} onPress={() => setFilter(null)} />
          {routeCodes.map((code) => (
            <Chip key={code} label={code} selected={filter === code} onPress={() => setFilter(code)} />
          ))}
        </ScrollView>
        {/* Placeholders until the first answer, and at least SKELETON_LONG_MS on the first visit (B8) */}
        {loadingFeed ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : shown.length === 0 ? (
          <Card style={styles.empty}>
            <MessagesSquare color={colors.textTertiary} size={EMPTY_ICON} />
            <Text style={typography.labelLg}>{strings.crowdsource.empty}</Text>
            <Text style={[typography.bodySm, styles.center]}>{needsSignIn ? strings.crowdsource.signIn : strings.crowdsource.emptyBody}</Text>
          </Card>
        ) : (
          shown.map((post, index) => (
            // Posts fade up in a short stagger; a flagged one fades out and the rest close the gap
            <Animated.View
              key={post.id}
              entering={FadeInDown.duration(motion.cardMs).delay(Math.min(index, STAGGER_MAX) * STAGGER_MS)}
              exiting={FadeOut.duration(motion.cardMs)}
              layout={LinearTransition.duration(motion.cardMs)}
            >
              <PostCard
                post={post}
                nowMs={nowMs}
                color={colorOf(post.routeCode)}
                stopName={stopNameOf(post.stopCode)}
                mine={ownName !== null && post.username === ownName}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// Asks first, then flags; the post disappears for this user when the flag is accepted
function confirmFlag(post: FeedPost) {
  showDialog({
    tone: 'warning',
    icon: Flag,
    title: strings.crowdsource.flagTitle,
    body: strings.crowdsource.flagBody(FEED_FLAG_HIDE_COUNT),
    actions: [
      {
        label: strings.crowdsource.flagConfirm,
        variant: 'danger',
        onPress: () => {
          void flagPost(post.id, post.demo).then((result) => {
            if (result.ok) showDialog({ tone: 'success', title: strings.crowdsource.flaggedTitle, body: strings.crowdsource.flaggedBody });
            else if (result.reason === 'sign_in') router.push('/sign-in');
            else showDialog({ tone: 'danger', title: strings.crowdsource.flagFailedTitle, body: result.message ?? strings.crowdsource.flagFailedBody });
          });
        },
      },
      { label: strings.crowdsource.flagCancel, variant: 'secondary' },
    ],
  });
}

function PostCard({ post, nowMs, color, stopName, mine }: { post: FeedPost; nowMs: number; color: string; stopName: string | null; mine: boolean }) {
  const styles = useStyles();
  const { colors, typography, mapPaint } = useTheme();
  const ago = strings.crowdsource.ago(Math.floor((nowMs - post.postedMs) / MS_PER_MIN));
  const tierColor = post.seatTier
    ? { green: mapPaint.occupancyGreen, amber: mapPaint.occupancyAmber, red: mapPaint.occupancyRed }[post.seatTier]
    : null;
  const status = [post.seatTier ? strings.crowdsource.seats[post.seatTier] : null, post.phrase ? strings.crowdsource.phrases[post.phrase] : null]
    .filter((part): part is string => part !== null)
    .join(' · ');
  return (
    // B6: compact: route, multicab, time, then seats and status, then the stop it was sent near
    <Card style={styles.post}>
      {/* What the multicab is on the left (wraps on a narrow screen), when and Flag on the right */}
      <View style={styles.head}>
        <View style={styles.identity}>
          <LineBadge code={post.routeCode} color={color} />
          <Text style={[typography.labelLg, styles.shrink]} numberOfLines={1}>
            {post.vehicleId ?? strings.crowdsource.noVehicle}
          </Text>
          {post.trusted ? (
            <View style={styles.trusted} accessible accessibilityLabel={strings.crowdsource.trustedLabel}>
              <ShieldCheck color={colors.success} size={ICON_SIZE} />
              <Text style={[typography.labelMd, styles.trustedText]}>{strings.crowdsource.trusted}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.when}>
          <Clock color={colors.textSecondary} size={ICON_SIZE} />
          <Text style={typography.bodySm}>{ago}</Text>
          {mine ? (
            <StatusPill label={strings.crowdsource.you} tone="neutral" />
          ) : (
            <Pressable
              style={({ pressed }) => [styles.flag, pressed && styles.flagPressed]}
              hitSlop={FLAG_HIT_SLOP}
              onPress={() => confirmFlag(post)}
              accessibilityRole="button"
              accessibilityLabel={strings.crowdsource.flagLabel(post.username)}
            >
              <Flag color={colors.textSecondary} size={ICON_SIZE} />
            </Pressable>
          )}
        </View>
      </View>
      <View style={styles.row}>
        {tierColor ? <View style={[styles.dot, { backgroundColor: tierColor }]} /> : null}
        <Text style={[typography.bodyMd, styles.grow]} numberOfLines={1}>
          {status}
        </Text>
      </View>
      {stopName ? (
        <View style={styles.row}>
          <MapPin color={colors.textSecondary} size={ICON_SIZE} />
          <Text style={[typography.bodySm, styles.grow]} numberOfLines={1}>
            {strings.crowdsource.near(stopName)}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  top: {
    paddingHorizontal: spacing.md,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm + spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  filters: {
    gap: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  center: {
    textAlign: 'center',
  },
  // B6: the card's own padding (spacing.md), a little more room between its rows
  post: {
    gap: spacing.sm + spacing.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  identity: {
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shrink: {
    flexShrink: 1,
  },
  trusted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.pill,
    backgroundColor: colors.successContainer,
  },
  trustedText: {
    color: colors.success,
  },
  flag: {
    width: FLAG_SIZE,
    height: FLAG_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  flagPressed: {
    backgroundColor: colors.surface,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pill,
  },
}));

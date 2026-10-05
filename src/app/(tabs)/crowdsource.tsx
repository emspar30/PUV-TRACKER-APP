import { router, useIsFocused } from 'expo-router';
import { Clock, Flag, MessagesSquare, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Chip, LineBadge, SkeletonCard, StatusPill, TopBar } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { DEMO_SEED, FEED_FLAG_HIDE_COUNT } from '@/shared/config';
import { demoFeed, type FeedPost } from '@/shared/demo/feed';
import { feedBadge } from '@/shared/feed/badge';
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
const BADGE_SIZE = spacing.xl + spacing.xs;
const REFRESH_MS = 30000;
const MS_PER_MIN = 60000;
const STAGGER_MS = 40;
const STAGGER_MAX = 6;

// Crowdsource (restyle, N1): commuter reports from the last hour. With Demo data on, the user's own
// demo reports (RP1) and the made-up feed; with it off, the database feed. Each post shows the
// author's neutral badge (D2) and, on other people's posts, a Flag button: a flagged post is hidden
// for the user at once, and for everyone at FEED_FLAG_HIDE_COUNT flags.
// Reloads when a report is sent (the wallet changes), every REFRESH_MS, and on focus.
export default function CrowdsourceScreen() {
  const styles = useStyles();
  const { colors, typography, routeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const demo = useSettingsStore((state) => state.demoData);
  const { lines } = useRouteData();
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
  const posts = demo ? [...(mine ?? []), ...demoFeed(routeCodes, nowMs, DEMO_SEED)] : (mine ?? []);
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
        {/* Live data loads over the network: placeholders until the first answer */}
        {!demo && crowd.reports.source === 'live' && loaded === null ? (
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
              <PostCard post={post} nowMs={nowMs} color={colorOf(post.routeCode)} mine={ownName !== null && post.username === ownName} />
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

function PostCard({ post, nowMs, color, mine }: { post: FeedPost; nowMs: number; color: string; mine: boolean }) {
  const styles = useStyles();
  const { colors, typography, mapPaint, feedBadges } = useTheme();
  const ago = strings.crowdsource.ago(Math.floor((nowMs - post.postedMs) / MS_PER_MIN));
  const badge = feedBadge(post.username, feedBadges.length);
  const badgeColor = feedBadges[badge.colorIndex] ?? { fill: colors.surface, ink: colors.textPrimary };
  const tierColor = post.seatTier
    ? { green: mapPaint.occupancyGreen, amber: mapPaint.occupancyAmber, red: mapPaint.occupancyRed }[post.seatTier]
    : null;
  return (
    <Card>
      <View style={styles.author}>
        {/* D2: a neutral badge from the handle, never the avatar */}
        <View style={[styles.badge, { backgroundColor: badgeColor.fill }]} importantForAccessibility="no-hide-descendants">
          <Text style={[typography.labelLg, { color: badgeColor.ink }]}>{badge.initial}</Text>
        </View>
        <View style={styles.grow}>
          <Text style={typography.labelLg} numberOfLines={1}>
            {`@${post.username}`}
          </Text>
          <View style={styles.meta}>
            <Clock color={colors.textSecondary} size={ICON_SIZE} />
            <Text style={typography.bodySm}>{ago}</Text>
          </View>
        </View>
        {mine ? (
          <StatusPill label={strings.crowdsource.you} tone="neutral" />
        ) : (
          <Pressable
            style={({ pressed }) => [styles.flag, pressed && styles.flagPressed]}
            onPress={() => confirmFlag(post)}
            accessibilityRole="button"
            accessibilityLabel={strings.crowdsource.flagLabel(post.username)}
          >
            <Flag color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        )}
      </View>
      <View style={styles.postHead}>
        <LineBadge code={post.routeCode} color={color} />
        <Text style={[typography.headlineSm, styles.grow]}>{post.phrase ? strings.crowdsource.phrases[post.phrase] : post.seatTier ? strings.crowdsource.seats[post.seatTier] : ''}</Text>
      </View>
      {post.seatTier && tierColor ? (
        <View style={styles.meta}>
          <View style={[styles.dot, { backgroundColor: tierColor }]} />
          <Users color={colors.textSecondary} size={ICON_SIZE} />
          <Text style={typography.bodySm}>{strings.crowdsource.seats[post.seatTier]}</Text>
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
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  flag: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  flagPressed: {
    backgroundColor: colors.surface,
  },
  postHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pill,
  },
}));

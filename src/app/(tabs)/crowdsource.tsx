import { useIsFocused } from 'expo-router';
import { Clock, MapPin, MessagesSquare, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Chip, LineBadge, StatusPill, TopBar } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { DEMO_SEED } from '@/shared/config';
import { demoFeed, type FeedPost } from '@/shared/demo/feed';
import { useSettingsStore } from '@/state/settingsStore';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md;
const EMPTY_ICON = spacing.xl;
const DOT = spacing.sm + spacing.xs / 2;
const REFRESH_MS = 30000;
const MS_PER_MIN = 60000;

// Crowdsource (restyle): commuter reports from the last hour. With Demo data on, the demo feed;
// the database feed (N1) and the Report button (RP1) come later, so with it off the list is empty.
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

  useEffect(() => {
    if (!focused) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  }, [focused]);

  const posts = demo ? demoFeed(routeCodes, nowMs, DEMO_SEED) : [];
  const shown = filter ? posts.filter((post) => post.routeCode === filter) : posts;
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
          {demo ? <Chip label={strings.common.demo} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip label={strings.crowdsource.all} selected={filter === null} onPress={() => setFilter(null)} />
          {routeCodes.map((code) => (
            <Chip key={code} label={code} selected={filter === code} onPress={() => setFilter(code)} />
          ))}
        </ScrollView>
        {shown.length === 0 ? (
          <Card style={styles.empty}>
            <MessagesSquare color={colors.textTertiary} size={EMPTY_ICON} />
            <Text style={typography.labelLg}>{strings.crowdsource.empty}</Text>
            <Text style={[typography.bodySm, styles.center]}>{strings.crowdsource.emptyBody}</Text>
          </Card>
        ) : (
          shown.map((post) => <PostCard key={post.id} post={post} nowMs={nowMs} color={colorOf(post.routeCode)} />)
        )}
      </ScrollView>
    </View>
  );
}

function PostCard({ post, nowMs, color }: { post: FeedPost; nowMs: number; color: string }) {
  const styles = useStyles();
  const { colors, typography, mapPaint } = useTheme();
  const ago = strings.crowdsource.ago(Math.floor((nowMs - post.postedMs) / MS_PER_MIN));
  const tierColor = post.seatTier
    ? { green: mapPaint.occupancyGreen, amber: mapPaint.occupancyAmber, red: mapPaint.occupancyRed }[post.seatTier]
    : null;
  return (
    <Card>
      <View style={styles.postHead}>
        <LineBadge code={post.routeCode} color={color} />
        <Text style={[typography.labelLg, styles.grow]}>{strings.crowdsource.phrases[post.phrase]}</Text>
        <StatusPill label={post.withGps ? strings.crowdsource.gps : strings.crowdsource.noGps} tone={post.withGps ? 'success' : 'neutral'} />
      </View>
      {post.seatTier && tierColor ? (
        <View style={styles.meta}>
          <View style={[styles.dot, { backgroundColor: tierColor }]} />
          <Users color={colors.textSecondary} size={ICON_SIZE} />
          <Text style={typography.bodySm}>{strings.crowdsource.seats[post.seatTier]}</Text>
        </View>
      ) : null}
      <View style={styles.meta}>
        {post.withGps ? <MapPin color={colors.textSecondary} size={ICON_SIZE} /> : <Clock color={colors.textSecondary} size={ICON_SIZE} />}
        <Text style={typography.bodySm}>{strings.crowdsource.byline(post.username, ago)}</Text>
      </View>
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

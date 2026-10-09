import { router } from 'expo-router';
import { ArrowRight, ChevronDown, ChevronUp, Info, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Logo } from '@/components';
import { TourTarget } from '@/features/tour/TourTarget';
import { pickGreeting } from '@/shared/profile/greeting';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const LOGO_SIZE = spacing.xl;
const ICON_SIZE = spacing.md + spacing.xs;
const SMALL_ICON = spacing.md;

// The Map tab's card while no route is picked (restyle): Tunton's greeting (D11), a search field
// that opens My Rides, and the way to the route list
export function ExploreCard({ onAllRoutes }: { onAllRoutes: () => void }) {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  // Chosen once per app open, so the line does not change while the screen is open
  const [greeting] = useState(() => pickGreeting(strings.persona.greetings, new Date()));
  // Minimized, only the search field stays, so more of the map shows
  const [minimized, setMinimized] = useState(false);
  const Chevron = minimized ? ChevronUp : ChevronDown;
  const toggle = (
    <Pressable
      style={styles.toggle}
      onPress={() => setMinimized((value) => !value)}
      accessibilityRole="button"
      accessibilityLabel={minimized ? strings.live.explore.expand : strings.live.explore.minimize}
    >
      <Chevron color={colors.textSecondary} size={ICON_SIZE} />
    </Pressable>
  );
  // ST2-D: the tips tour points at the search field
  const search = (
    <TourTarget id="search" style={minimized ? styles.grow : undefined}>
      <Pressable style={styles.search} onPress={() => router.navigate('/ride')} accessibilityRole="search">
        <Search color={colors.textSecondary} size={ICON_SIZE} />
        <Text style={[typography.bodyLg, styles.placeholder]} numberOfLines={1}>
          {strings.live.explore.search}
        </Text>
      </Pressable>
    </TourTarget>
  );
  if (minimized) {
    return (
      <View style={[styles.card, styles.mini, elevation.level3]}>
        {search}
        {toggle}
      </View>
    );
  }
  return (
    <View style={[styles.card, elevation.level3]}>
      <View style={styles.head}>
        <Logo size={LOGO_SIZE} />
        <View style={styles.grow}>
          <Text style={typography.headlineSm}>{strings.live.explore.title}</Text>
          <Text style={typography.bodySm} numberOfLines={1}>
            {greeting}
          </Text>
        </View>
        {toggle}
      </View>
      {search}
      <View style={styles.foot}>
        <Info color={colors.warning} size={SMALL_ICON} />
        <Text style={[typography.bodySm, styles.grow]} numberOfLines={2}>
          {strings.live.explore.hint}
        </Text>
        <Pressable style={styles.link} onPress={onAllRoutes} accessibilityRole="button">
          <Text style={[typography.labelLg, styles.linkText]}>{strings.live.explore.allRoutes}</Text>
          <ArrowRight color={colors.primary} size={SMALL_ICON} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    gap: spacing.sm + spacing.xs,
    padding: spacing.md,
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
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  toggle: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  link: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  linkText: {
    color: colors.primary,
  },
}));

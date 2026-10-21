import { ChevronDown, ChevronUp, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Logo } from '@/components';
import { pickGreeting } from '@/shared/profile/greeting';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const LOGO_SIZE = spacing.xl;
const ICON_SIZE = spacing.md + spacing.xs;

// CA1.1: the top of My Rides before a destination is being picked (moved from the Map, which has
// enough on it): Tunton's greeting (D11) and "Where are you heading today?", which opens typing in To.
// Minimized, only the search field stays, so more of the map shows. The field and its minimize button
// never move; the greeting above them fades in and out.
export function HeadingCard({ onSearch }: { onSearch: () => void }) {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  // Chosen once per app open, so the line does not change while the screen is open
  const [greeting] = useState(() => pickGreeting(strings.persona.greetings, new Date()));
  const [minimized, setMinimized] = useState(false);
  const Chevron = minimized ? ChevronDown : ChevronUp;
  return (
    <View style={[styles.card, elevation.level3]}>
      {minimized ? null : (
        <Animated.View style={styles.head} entering={FadeIn.duration(motion.cardMs)} exiting={FadeOut.duration(motion.dialogMs)}>
          <Logo size={LOGO_SIZE} />
          <View style={styles.grow}>
            <Text style={typography.headlineSm}>{strings.live.explore.title}</Text>
            <Text style={typography.bodySm} numberOfLines={1}>
              {greeting}
            </Text>
          </View>
        </Animated.View>
      )}
      <View style={styles.row}>
        <Pressable style={styles.search} onPress={onSearch} accessibilityRole="search">
          <Search color={colors.textSecondary} size={ICON_SIZE} />
          <Text style={[typography.bodyLg, styles.placeholder]} numberOfLines={1}>
            {strings.live.explore.search}
          </Text>
        </Pressable>
        <Pressable
          style={styles.toggle}
          onPress={() => setMinimized((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={minimized ? strings.live.explore.expand : strings.live.explore.minimize}
        >
          <Chevron color={colors.textSecondary} size={ICON_SIZE} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    gap: spacing.sm + spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  grow: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggle: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flex: 1,
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
}));

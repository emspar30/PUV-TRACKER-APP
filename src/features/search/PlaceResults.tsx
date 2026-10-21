import { MapPin, Star } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Skeleton } from '@/components';
import { SEARCH_SKELETON_MS, SEARCH_SKELETON_ROWS } from '@/shared/config';
import type { SearchablePlace } from '@/shared/routing/placeSearch';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const SKELETON_ROWS = Array.from({ length: SEARCH_SKELETON_ROWS }, (_value, index) => index);

const ICON_SIZE = spacing.md + spacing.xs;

// ST2-C2, ST2-D2: the matches under a search field (My Rides From and To, the relay's destination):
// the name, and under it a stop's code, "Your place", or the kind of place and the barangay it is
// near. "No stop or place by that name" once something is typed and nothing matches. CA1.1: after
// each change of the typed text, placeholder rows shimmer for SEARCH_SKELETON_MS, then the results
// fade in.
export function PlaceResults({
  matches,
  query,
  onChoose,
  raised = false,
}: {
  matches: readonly SearchablePlace[];
  query: string;
  onChoose: (place: SearchablePlace) => void;
  // A floating list (over the map) has a shadow; one inside a sheet does not
  raised?: boolean;
}) {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  // The text the results on show belong to; it catches up SEARCH_SKELETON_MS after the typing
  const [shownQuery, setShownQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setShownQuery(query), SEARCH_SKELETON_MS);
    return () => clearTimeout(timer);
  }, [query]);
  if (matches.length === 0 && query.trim().length === 0) return null;
  if (shownQuery !== query) {
    return (
      <View style={[styles.results, raised && elevation.level2]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {SKELETON_ROWS.map((row) => (
          <View key={row} style={[styles.result, row > 0 && styles.divider]}>
            <Skeleton width={ICON_SIZE} height={ICON_SIZE} round />
            <View style={[styles.grow, styles.skeletonLines]}>
              <Skeleton width="60%" />
              <Skeleton width="35%" height={spacing.sm + spacing.xs} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <Animated.View key={shownQuery} entering={FadeIn.duration(motion.cardMs)} style={[styles.results, raised && elevation.level2]}>
      {matches.length === 0 ? <Text style={[typography.bodyMd, styles.noMatch]}>{strings.ride.noMatches}</Text> : null}
      {matches.map((place, index) => (
        <Pressable
          key={place.id}
          style={[styles.result, index > 0 && styles.divider]}
          onPress={() => onChoose(place)}
          accessibilityRole="button"
          accessibilityLabel={strings.ride.searchResult(place.title)}
        >
          {place.kind === 'saved' ? (
            <Star color={colors.warning} size={ICON_SIZE} />
          ) : (
            <MapPin color={place.kind === 'stop' ? colors.primary : colors.textSecondary} size={ICON_SIZE} />
          )}
          <View style={styles.grow}>
            <Text style={typography.labelLg} numberOfLines={1}>
              {place.title}
            </Text>
            <Text style={typography.bodySm} numberOfLines={1}>
              {strings.ride.resultDetail(place)}
            </Text>
          </View>
        </Pressable>
      ))}
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  results: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  result: {
    minHeight: MIN_TOUCH_TARGET + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  grow: {
    flex: 1,
  },
  noMatch: {
    padding: spacing.md,
  },
  skeletonLines: {
    gap: spacing.xs,
  },
}));

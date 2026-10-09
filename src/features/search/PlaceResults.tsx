import { MapPin, Star } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import type { SearchablePlace } from '@/shared/routing/placeSearch';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;

// ST2-C2, ST2-D2: the matches under a search field (My Rides From and To, the relay's destination):
// the name, and under it a stop's code, "Your place", or the kind of place and the barangay it is
// near. "No stop or place by that name" once something is typed and nothing matches.
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
  if (matches.length === 0 && query.trim().length === 0) return null;
  return (
    <View style={[styles.results, raised && elevation.level2]}>
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
    </View>
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
}));

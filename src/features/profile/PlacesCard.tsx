import { MapPin, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { FREQUENT_DESTINATIONS_MAX } from '@/shared/config';
import { routesNear } from '@/shared/routing/suggest';
import { useDestinationsStore } from '@/state/destinationsStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;

// F3: the frequent destinations on Profile, each with the routes that pass within a walk of it
// (PRD 19, D4). Saved on this phone only; added in the introduction or with the star on To in
// My Rides (a stop or a point tapped on the map), removed here.
export function PlacesCard() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { lines } = useRouteData();
  const destinations = useDestinationsStore((state) => state.destinations);
  const remove = useDestinationsStore((state) => state.remove);

  return (
    <Card>
      <Text style={typography.labelLg}>{strings.places.title(destinations.length, FREQUENT_DESTINATIONS_MAX)}</Text>
      {destinations.length === 0 ? <Text style={typography.bodySm}>{strings.places.empty}</Text> : null}
      {destinations.map((place) => (
        <View key={place.id} style={styles.row}>
          <MapPin color={colors.textSecondary} size={ICON_SIZE} />
          <View style={styles.grow}>
            <Text style={typography.bodyMd} numberOfLines={1}>
              {place.label}
            </Text>
            <Text style={typography.bodySm}>{strings.places.routes(routesNear(lines, place).map((item) => item.routeCode))}</Text>
          </View>
          <Pressable style={styles.icon} onPress={() => remove(place.id)} accessibilityRole="button" accessibilityLabel={strings.places.remove(place.label)}>
            <X color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  icon: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

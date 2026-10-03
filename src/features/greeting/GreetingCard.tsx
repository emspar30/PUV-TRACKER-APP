import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Chip, Logo } from '@/components';
import { pickGreeting } from '@/shared/profile/greeting';
import { useDestinationsStore } from '@/state/destinationsStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const LOGO_SIZE = spacing.lg;
const ICON_SIZE = spacing.md + spacing.xs;

// Opens My Ride with a frequent destination set as "To". The time stamp makes a second tap on the
// same chip count as a new request.
function planRideTo(destinationId: string | null) {
  if (destinationId === null) {
    router.navigate('/ride');
    return;
  }
  router.navigate({ pathname: '/ride', params: { to: destinationId, at: String(Date.now()) } });
}

// Tunton's greeting on the Live tab (PRD 19, D11): one time-based line and the frequent
// destinations as chips. It reads the destinations on the phone and sends nothing anywhere.
export function GreetingCard({ onHide }: { onHide: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  // Chosen once per app open, so the line does not change while the screen is open
  const [line] = useState(() => pickGreeting(strings.persona.greetings, new Date()));
  const destinations = useDestinationsStore((state) => state.destinations);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Logo size={LOGO_SIZE} />
        <Text style={[typography.labelLg, styles.grow]} numberOfLines={2}>
          {line}
        </Text>
        <Pressable
          style={styles.close}
          onPress={onHide}
          accessibilityRole="button"
          accessibilityLabel={strings.greeting.hide}
        >
          <X color={colors.textSecondary} size={ICON_SIZE} />
        </Pressable>
      </View>
      <View style={styles.chips}>
        {destinations.length > 0 ? (
          destinations.map((destination) => (
            <Chip
              key={destination.id}
              label={destination.label}
              accessibilityLabel={strings.greeting.goTo(destination.label)}
              onPress={() => planRideTo(destination.id)}
            />
          ))
        ) : (
          <Chip label={strings.greeting.planRide} onPress={() => planRideTo(null)} />
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  card: {
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingBottom: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.sheet,
    ...elevation.level2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  close: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
}));

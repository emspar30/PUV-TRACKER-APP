import { Bell, BellOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Screen, SkeletonCard } from '@/components';
import { useSkeleton } from '@/features/loading/useSkeleton';
import { SKELETON_LONG_MS } from '@/shared/config';
import { useNotificationsStore } from '@/state/notificationsStore';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.xl;
const ROW_ICON_SIZE = spacing.lg;
const MS_PER_MIN = 60000;

// Opened from the bell in the top bar: the in-app alerts and updates shown as toasts (arrival
// alerts, check-in and relay updates, new badges), newest first, kept on this phone.
export default function NotificationsScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const items = useNotificationsStore((state) => state.items);
  const clear = useNotificationsStore((state) => state.clear);
  const markSeen = useNotificationsStore((state) => state.markSeen);
  // Opening the list reads everything in it, and one that arrives while it is open; the bell dot goes
  useEffect(() => {
    markSeen(Date.now());
  }, [items, markSeen]);
  // The page reads the time once when it opens, for "5 min ago"
  const [nowMs] = useState(() => Date.now());
  // B8: a short placeholder first, like the other screens whose data comes over the network
  const loading = useSkeleton(SKELETON_LONG_MS);
  if (loading) {
    return (
      <Screen title={strings.notifications.title}>
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }
  if (items.length === 0) {
    return (
      <Screen title={strings.notifications.title}>
        <Card style={styles.empty}>
          <BellOff color={colors.textTertiary} size={ICON_SIZE} />
          <Text style={typography.labelLg}>{strings.notifications.empty}</Text>
          <Text style={[typography.bodySm, styles.center]}>{strings.notifications.emptyBody}</Text>
        </Card>
      </Screen>
    );
  }
  return (
    <Screen title={strings.notifications.title}>
      {items.map((item) => (
        <Card key={item.id} style={styles.row}>
          <Bell color={colors.primary} size={ROW_ICON_SIZE} />
          <View style={styles.text}>
            <Text style={typography.labelLg}>{item.title}</Text>
            {item.body ? <Text style={typography.bodySm}>{item.body}</Text> : null}
            <Text style={[typography.caption, { color: colors.textTertiary }]}>
              {strings.ride.ago(Math.max(0, Math.floor((nowMs - item.atMs) / MS_PER_MIN)))}
            </Text>
          </View>
        </Card>
      ))}
      <Button label={strings.notifications.clear} variant="secondary" onPress={clear} />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  center: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
}));

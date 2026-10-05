import { BellOff } from 'lucide-react-native';
import { Text } from 'react-native';

import { Card, Screen } from '@/components';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.xl;

// Opened from the bell in the top bar. Notifications arrive in a later step; until then it is empty.
export default function NotificationsScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
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

const useStyles = makeStyles(() => ({
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  center: {
    textAlign: 'center',
  },
}));

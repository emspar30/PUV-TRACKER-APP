import { RadioTower } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Button, IconTile } from '@/components';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

type RelayBarProps = {
  routeCode: string;
  destination: string;
  onStop: () => void;
};

// B4: shown on the Map while a relay shares the rider's location; it ends by itself at the destination
export function RelayBar({ routeCode, destination, onStop }: RelayBarProps) {
  const styles = useStyles();
  const { typography, elevation } = useTheme();
  const t = strings.report;
  return (
    <View style={[styles.bar, elevation.level3]} accessibilityLiveRegion="polite">
      <IconTile icon={RadioTower} tone="success" />
      <View style={styles.grow}>
        <Text style={typography.labelLg} numberOfLines={1}>
          {t.sharingTitle}
        </Text>
        <Text style={typography.bodySm} numberOfLines={1}>
          {t.sharingDetail(routeCode, destination)}
        </Text>
      </View>
      <Button label={t.stopSharing} variant="secondary" onPress={onStop} />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  grow: {
    flex: 1,
  },
}));

import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { makeStyles, radii, spacing, useTheme } from '@/theme';

export type IconTone = 'primary' | 'success' | 'warning' | 'danger';

type IconTileProps = {
  icon: LucideIcon;
  tone?: IconTone;
};

const TILE_SIZE = spacing.xl + spacing.xs;
const ICON_SIZE = spacing.md + spacing.xs;

// A small tinted square holding an icon, at the start of a feature or option row (restyle)
export function IconTile({ icon: Icon, tone = 'primary' }: IconTileProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fill = { primary: colors.primaryContainer, success: colors.successContainer, warning: colors.warningContainer, danger: colors.dangerContainer }[tone];
  const ink = { primary: colors.primary, success: colors.success, warning: colors.warning, danger: colors.danger }[tone];
  return (
    <View style={[styles.tile, { backgroundColor: fill }]} importantForAccessibility="no-hide-descendants">
      <Icon color={ink} size={ICON_SIZE} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
}));

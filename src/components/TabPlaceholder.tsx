import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

import { AvatarButton } from './AvatarButton';

const ICON_SIZE = spacing.xl * 2;

// A tab whose screen is built in a later UX2 part
export function TabPlaceholder({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.topRight, { top: insets.top + spacing.sm }]}>
        <AvatarButton />
      </View>
      <Icon color={colors.textTertiary} size={ICON_SIZE} />
      <Text style={typography.headlineSm}>{title}</Text>
      <Text style={typography.bodySm}>{strings.common.comingSoon}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.canvas,
  },
  topRight: {
    position: 'absolute',
    right: spacing.md,
  },
}));

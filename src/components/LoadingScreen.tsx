import { ActivityIndicator, Text, View } from 'react-native';

import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

import { Logo } from './Logo';

const LOGO_SIZE = spacing.xl * 3 + spacing.md;

// The first screen of every launch (restyle): the logo, the name and what is being prepared
export function LoadingScreen({ message }: { message?: string }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={styles.root} accessibilityLabel={strings.app.name}>
      <View style={styles.center}>
        <Logo size={LOGO_SIZE} />
        <Text style={[typography.headlineLg, styles.name]}>{strings.app.name}</Text>
        <Text style={typography.bodyMd}>{strings.app.tagline}</Text>
      </View>
      <View style={styles.foot}>
        <ActivityIndicator color={colors.primary} />
        {message ? <Text style={typography.bodySm}>{message}</Text> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.canvas,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  name: {
    marginTop: spacing.md,
  },
  foot: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
}));

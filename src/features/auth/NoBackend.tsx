import { CloudOff } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.xl;

// AU1: a release build made without the backend keys cannot sign anyone in, so it stops here rather
// than letting someone in without an account. A development build carries on (PRD 7.1).
export function NoBackend() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <CloudOff color={colors.textSecondary} size={ICON_SIZE} />
        <Text style={[typography.headlineSm, styles.center]} accessibilityRole="header">
          {strings.noBackend.title}
        </Text>
        <Text style={[typography.bodyMd, styles.center]}>{strings.noBackend.body}</Text>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
}));

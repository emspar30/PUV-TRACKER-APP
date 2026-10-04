import { X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md;

// One short first-run line for a tab (AF1), with an X. The caller stores that it was dismissed.
export function Hint({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={styles.hint} accessibilityRole="text">
      <Text style={[typography.bodyMd, styles.text]}>{text}</Text>
      <Pressable style={styles.close} onPress={onDismiss} accessibilityRole="button" accessibilityLabel={strings.hints.dismiss}>
        <X color={colors.onPrimaryContainer} size={ICON_SIZE} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primaryContainer,
  },
  text: {
    flex: 1,
    color: colors.onPrimaryContainer,
  },
  close: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

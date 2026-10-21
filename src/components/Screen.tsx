import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, spacing, useTheme } from '@/theme';

type ScreenProps = {
  title: string;
  children?: ReactNode;
  // Shown on the right of the title row, such as a menu button
  action?: ReactNode;
  // AU1: no arrow on a page that must not be left (sign-in when an account is needed)
  noBack?: boolean;
};

const ICON_SIZE = spacing.lg;

// A full page with a back arrow and its title (restyle: every page can be left without the system
// Back button). On the first screen of the app there is nothing to go back to, so no arrow.
export function Screen({ title, children, action, noBack = false }: ScreenProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.bar}>
        {!noBack && router.canGoBack() ? (
          <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={strings.common.back}>
            <ArrowLeft color={colors.textPrimary} size={ICON_SIZE} />
          </Pressable>
        ) : null}
        <Text style={[typography.headlineSm, styles.title]} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {action}
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  bar: {
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  back: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    paddingHorizontal: spacing.sm + spacing.xs,
  },
  content: {
    padding: spacing.md,
    // Room at the end, so the last control clears the system navigation bar
    paddingBottom: spacing.xl + spacing.lg,
    gap: spacing.md,
  },
}));

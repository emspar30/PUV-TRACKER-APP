import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme';

type ScreenProps = {
  title: string;
  // 'fill' gives the children the whole area under the title, edge to edge and
  // without scrolling (used by the map)
  mode?: 'scroll' | 'fill';
  children?: ReactNode;
};

export function Screen({ title, mode = 'scroll', children }: ScreenProps) {
  const heading = (
    <Text style={typography.title} accessibilityRole="header">
      {title}
    </Text>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {mode === 'fill' ? (
        <>
          <View style={styles.header}>{heading}</View>
          <View style={styles.fill}>{children}</View>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {heading}
          {children}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fill: {
    flex: 1,
  },
});

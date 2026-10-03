import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Logo, Screen } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, radii, spacing, useTheme } from '@/theme';

const LOGO_SIZE = spacing.xl * 2;

export default function AboutScreen() {
  const styles = useStyles();
  const { typography } = useTheme();
  const { isPlaceholder } = useRouteData();
  const version = Constants.expoConfig?.version ?? '';

  return (
    <Screen title={strings.about.title}>
      <View style={styles.header}>
        <Logo size={LOGO_SIZE} />
        <View style={styles.grow}>
          <Text style={typography.body}>{Constants.expoConfig?.name ?? strings.app.name}</Text>
          {version ? <Text style={typography.caption}>{strings.about.version(version)}</Text> : null}
          <Text style={typography.caption}>{strings.app.tagline}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={typography.body}>{strings.about.mapTitle}</Text>
        <Text style={typography.body}>{strings.common.attribution}</Text>
        <Text style={typography.caption}>{strings.about.mapBody}</Text>
      </View>

      <View style={styles.card}>
        <Text style={typography.body}>{strings.about.routeTitle}</Text>
        {isPlaceholder ? <Text style={styles.amber}>{strings.about.routeBody}</Text> : null}
        <Text style={typography.caption}>{strings.about.fareBody}</Text>
      </View>

      <View style={styles.card}>
        <Text style={typography.body}>{strings.about.storedTitle}</Text>
        {strings.about.storedPoints.map((point) => (
          <View key={point} style={styles.point}>
            <View style={styles.bullet} />
            <Text style={[typography.caption, styles.grow]}>{point}</Text>
          </View>
        ))}
        <Text style={typography.caption}>{strings.about.notStored}</Text>
      </View>

      <Pressable style={styles.button} onPress={() => router.back()} accessibilityRole="button">
        <Text style={typography.body}>{strings.common.back}</Text>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  grow: {
    flex: 1,
  },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  amber: {
    ...typography.caption,
    color: colors.warning,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    width: spacing.xs,
    height: spacing.xs,
    marginTop: spacing.sm - spacing.xs / 2,
    borderRadius: spacing.xs,
    backgroundColor: colors.textSecondary,
  },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
}));

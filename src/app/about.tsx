import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Lock, Map as MapIcon, TriangleAlert, Type } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Logo, Screen } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const LOGO_SIZE = spacing.xl * 2;
const ICON_SIZE = spacing.md + spacing.xs;

// About: name and version, the map credit, the sample-data note and what stays on the phone.
export default function AboutScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { isPlaceholder } = useRouteData();
  const version = Constants.expoConfig?.version ?? '';

  return (
    <Screen title={strings.about.title}>
      <View style={styles.row}>
        <Logo size={LOGO_SIZE} />
        <View>
          <Text style={typography.headlineSm}>{Constants.expoConfig?.name ?? strings.app.name}</Text>
          {version ? <Text style={typography.bodySm}>{strings.about.version(version)}</Text> : null}
        </View>
      </View>

      <Line icon={<MapIcon color={colors.textSecondary} size={ICON_SIZE} />} text={strings.common.attribution} />
      <Line icon={<Type color={colors.textSecondary} size={ICON_SIZE} />} text={strings.about.fontCredit} />
      {isPlaceholder ? (
        <Line icon={<TriangleAlert color={colors.warning} size={ICON_SIZE} />} text={strings.about.sampleData} />
      ) : null}
      <Line icon={<Lock color={colors.textSecondary} size={ICON_SIZE} />} text={strings.about.staysOnPhone} />

      <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        <Text style={typography.labelLg}>{strings.common.back}</Text>
      </Pressable>
    </Screen>
  );
}

function Line({ icon, text }: { icon: ReactNode; text: string }) {
  const styles = useStyles();
  const { typography } = useTheme();
  return (
    <View style={styles.line}>
      {icon}
      <Text style={[typography.bodyMd, styles.grow]}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLow,
  },
  grow: {
    flex: 1,
  },
  back: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
}));

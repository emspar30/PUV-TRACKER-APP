import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components';
import { FONT_LICENCE_TEXT } from '@/data/licences/fontLicence.generated';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

// About → Licences: the map data credit and the full font licence. The SIL Open Font License asks
// that its text and the copyright notice accompany the fonts (LB1), so both are shown here in full.
export default function LicencesScreen() {
  const styles = useStyles();
  const { typography } = useTheme();

  return (
    <Screen title={strings.licences.title}>
      <View style={styles.block}>
        <Text style={typography.headlineSm}>{strings.licences.mapTitle}</Text>
        <Text style={typography.bodyMd}>{strings.common.attribution}</Text>
        <Text style={typography.bodySm}>{strings.licences.mapNote}</Text>
      </View>

      <View style={styles.block}>
        <Text style={typography.headlineSm}>{strings.licences.fontTitle}</Text>
        <Text style={typography.bodyMd}>{strings.licences.fontCopyright}</Text>
        <Text style={[typography.bodySm, styles.licence]} selectable>
          {FONT_LICENCE_TEXT}
        </Text>
      </View>

      <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        <Text style={typography.labelLg}>{strings.common.back}</Text>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  block: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLow,
  },
  licence: {
    fontVariant: ['tabular-nums'],
  },
  back: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
}));

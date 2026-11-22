import { router } from 'expo-router';
import { Moon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;

// Night Mode (PRD 10.4; owner, 2026-11-23): under the picked route's card, a short note that the map
// shows no multicab from 9 PM to 5 AM and that relays go to Crowdsource, with a button there. It
// replaces the "Where R4 has been" stop list: at night no relay is on the live map, so it would stay
// empty.
export function NightModeNote() {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  return (
    <View style={[styles.card, elevation.level2]} accessibilityRole="summary">
      <View style={styles.head}>
        <Moon color={colors.textSecondary} size={ICON_SIZE} />
        <Text style={typography.labelLg}>{strings.live.status.nightNoteTitle}</Text>
      </View>
      <Text style={typography.bodySm}>{strings.live.status.nightNoteBody}</Text>
      <Button label={strings.live.status.nightNoteAction} variant="secondary" onPress={() => router.navigate('/crowdsource')} />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    gap: spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
}));

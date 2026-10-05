import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { useDialogStore, type DialogAction, type DialogTone } from '@/state/dialogStore';
import { strings } from '@/strings';
import { makeStyles, motion, radii, spacing, useTheme } from '@/theme';

import { Button } from './Button';

const TILE_SIZE = spacing.xl + spacing.md;
const ICON_SIZE = spacing.lg;
const MAX_WIDTH = 400;
const TONE_ICON: Record<DialogTone, LucideIcon> = { primary: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };

// The app's dialog (C1 UI pass), in place of the system alert: a white card over a dimmed screen
// with a tinted icon, a title, a short body and stacked pill buttons, the main action first.
// Mounted once at the root, drawn above every screen (no system Modal, so no window flicker); the
// scrim fades and the card eases up a little (B1: no spring, no bounce). Screens call showDialog() from the dialog store.
export function DialogHost() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const current = useDialogStore((state) => state.current);
  const close = useDialogStore((state) => state.close);

  // The Back button closes the dialog instead of leaving the screen
  useEffect(() => {
    if (!current) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [current, close]);

  if (!current) return null;

  const Icon = current.icon ?? TONE_ICON[current.tone];
  const fill = { primary: colors.primaryContainer, success: colors.successContainer, warning: colors.warningContainer, danger: colors.dangerContainer }[current.tone];
  const ink = { primary: colors.primary, success: colors.success, warning: colors.warning, danger: colors.danger }[current.tone];
  const actions: readonly DialogAction[] = current.actions ?? [{ label: strings.common.ok }];
  // A one-button dialog closes on a tap outside; a choice must be made with a button
  const dismissable = actions.length === 1;
  const run = (action: DialogAction) => {
    close();
    action.onPress?.();
  };

  return (
    <Animated.View
      key={current.key}
      style={[StyleSheet.absoluteFill, styles.backdrop]}
      entering={FadeIn.duration(motion.dialogMs)}
      exiting={FadeOut.duration(motion.dialogMs)}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={dismissable ? close : undefined} accessible={false} />
      <Animated.View style={styles.card} entering={FadeInDown.duration(motion.dialogMs).easing(Easing.out(Easing.cubic))} accessibilityViewIsModal>
        <View style={[styles.tile, { backgroundColor: fill }]} importantForAccessibility="no-hide-descendants">
          <Icon color={ink} size={ICON_SIZE} />
        </View>
        <Text style={[typography.headlineSm, styles.center]} accessibilityRole="header">
          {current.title}
        </Text>
        <Text style={[typography.bodyMd, styles.body]}>{current.body}</Text>
        <View style={styles.actions}>
          {actions.map((action) => (
            <Button key={action.label} label={action.label} variant={action.variant ?? 'primary'} onPress={() => run(action)} />
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  backdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.scrim,
  },
  card: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.sheet,
    backgroundColor: colors.card,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  center: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    color: colors.textSecondary,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
}));

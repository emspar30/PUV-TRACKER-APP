import { Check, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import { IconTile, type IconTone } from './IconTile';

type OptionRowProps = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: IconTone;
  // A chip after the title, such as "20% off"
  badge?: string;
  // With onPress the row is a choice: a radio (or checkbox with `multiple`) on the right
  selected?: boolean;
  multiple?: boolean;
  onPress?: () => void;
  // Shown on the right instead of the selection mark, such as a status chip
  trailing?: ReactNode;
  accessibilityLabel?: string;
};

const MARK_SIZE = spacing.lg;
const MARK_ICON = spacing.md;

// One row card with an icon, a title and a subtitle (restyle). Used for choices and for feature lists.
export function OptionRow({ title, subtitle, icon, tone, badge, selected = false, multiple = false, onPress, trailing, accessibilityLabel }: OptionRowProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const choice = Boolean(onPress);
  const content = (
    <>
      {icon ? <IconTile icon={icon} tone={tone} /> : null}
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={typography.labelLg}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={[typography.labelSm, styles.badgeText]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={typography.bodySm}>{subtitle}</Text> : null}
      </View>
      {trailing}
      {choice && !trailing ? (
        <View style={[styles.mark, multiple && styles.markSquare, selected && styles.markOn]}>
          {selected ? <Check color={colors.onPrimary} size={MARK_ICON} /> : null}
        </View>
      ) : null}
    </>
  );
  if (!choice) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  text: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.pill,
    backgroundColor: colors.successContainer,
  },
  badgeText: {
    color: colors.success,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MARK_SIZE,
    borderWidth: 2,
    borderColor: colors.outline,
  },
  markSquare: {
    borderRadius: radii.badge,
  },
  markOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
}));

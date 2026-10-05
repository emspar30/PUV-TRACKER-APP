import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import { IconTile, type IconTone } from './IconTile';

// A titled group of rows in one card (restyle: Settings, Demo settings, Profile, the menu)
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  const styles = useStyles();
  const { typography } = useTheme();
  return (
    <View style={styles.group}>
      {title ? <Text style={[typography.overline, styles.groupTitle]}>{title}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

type SettingsRowProps = {
  icon: LucideIcon;
  tone?: IconTone;
  title: string;
  subtitle?: string;
  // A switch on the right
  value?: boolean;
  onValueChange?: (on: boolean) => void;
  // Text on the right, such as "Route 4" or "English"
  detail?: string;
  // A chip on the right, such as "Local only"
  badge?: string;
  // Makes the row a link with a chevron
  onPress?: () => void;
  // Red title, for Sign out and Reset
  destructive?: boolean;
  // The first row of a group has no divider above it
  first?: boolean;
};

export function SettingsRow({ icon, tone, title, subtitle, value, onValueChange, detail, badge, onPress, destructive, first }: SettingsRowProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const content = (
    <>
      <IconTile icon={icon} tone={destructive ? 'danger' : tone} />
      <View style={styles.text}>
        <Text style={[typography.labelLg, destructive && styles.danger]}>{title}</Text>
        {subtitle ? <Text style={typography.bodySm}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={[typography.labelSm, styles.badgeText]}>{badge}</Text>
        </View>
      ) : null}
      {detail ? <Text style={typography.bodySm}>{detail}</Text> : null}
      {onValueChange ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.surfaceHigh, true: colors.primary }}
          thumbColor={colors.card}
          accessibilityLabel={title}
        />
      ) : null}
      {onPress ? <ChevronRight color={colors.textSecondary} size={spacing.md + spacing.xs} /> : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable style={[styles.row, !first && styles.divider]} onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.row, !first && styles.divider]}>{content}</View>;
}

const useStyles = makeStyles(({ colors }) => ({
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    paddingHorizontal: spacing.xs,
  },
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  row: {
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  text: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  danger: {
    color: colors.danger,
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
}));

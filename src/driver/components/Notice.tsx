import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, radii, spacing, useTheme } from '@/theme';

type NoticeProps = {
  tone: 'warning' | 'danger';
  icon: LucideIcon;
  // The problem, in the tone's colour
  title: string;
  // What it means, or what to do
  body?: string;
  // The body in bold, for what to do ("Ask an admin.")
  strongBody?: boolean;
  // Under the text: buttons, or the steps of a fix
  children?: ReactNode;
};

const ICON_SIZE = spacing.lg;

// The driver app's notice (Stitch designs 3.2, 3.5, 3.6, 3.9, 3.12): a tinted card with a leading
// icon, the problem in the tone's colour and what it means under it. Information only unless the
// caller adds buttons; on the home screen it never has any (PRD 15.3).
export function Notice({ tone, icon: Icon, title, body, strongBody = false, children }: NoticeProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const ink = tone === 'danger' ? colors.danger : colors.warning;
  const fill = tone === 'danger' ? colors.dangerContainer : colors.warningContainer;
  return (
    <View style={[styles.notice, { backgroundColor: fill }]}>
      <View style={styles.row}>
        <Icon color={ink} size={ICON_SIZE} />
        <View style={styles.text}>
          <Text style={[typography.headlineSm, { color: ink }]}>{title}</Text>
          {body ? <Text style={[typography.bodyLg, strongBody && styles.strong]}>{body}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  notice: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + spacing.xs,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  strong: {
    fontWeight: '700',
  },
}));

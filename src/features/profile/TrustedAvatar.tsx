import { ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { useTrusted } from '@/state/trustStore';
import { strings } from '@/strings';
import { makeStyles, radii, useTheme } from '@/theme';

import { Avatar } from './Avatar';

// Share of the avatar the badge takes, and of the badge its icon
const BADGE_SHARE = 0.38;
const ICON_SHARE = 0.62;
const BADGE_BORDER = 2;

// B7: the user's avatar with the Trusted badge at its bottom right once they are Trusted
// (TRUST_BADGE_POINTS: check-ins or relays nobody flagged)
export function TrustedAvatar({ id, size }: { id: number; size: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const trusted = useTrusted();
  const badge = Math.round(size * BADGE_SHARE);
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={trusted ? strings.profilePage.trustedAvatar : undefined}>
      <Avatar id={id} size={size} />
      {trusted ? (
        <View style={[styles.badge, { width: badge, height: badge }]}>
          <ShieldCheck color={colors.onPrimary} size={Math.round(badge * ICON_SHARE)} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  badge: {
    position: 'absolute',
    right: -BADGE_BORDER,
    bottom: -BADGE_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: BADGE_BORDER,
    borderColor: colors.card,
    backgroundColor: colors.success,
  },
}));

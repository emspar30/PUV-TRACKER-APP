import { Award, HeartHandshake, Map as MapIcon, MapPin, Megaphone, Radio, Repeat, Route, type LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Card } from '@/components';
import { badgeStates, type BadgeId } from '@/shared/profile/badges';
import { badgeCountsOf, useCountsStore } from '@/state/countsStore';
import { useRidesStore } from '@/state/ridesStore';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;
const TILE = spacing.xl + spacing.sm;

const ICONS: Record<BadgeId, LucideIcon> = {
  first_trip: MapIcon,
  first_checkin: MapPin,
  stop_regular: Repeat,
  first_report: Megaphone,
  helping_hand: HeartHandshake,
  road_regular: Route,
  first_live_report: Radio,
};

// F5: the badges on Profile (PRD 19, D8), from this phone's own counts. Earned ones in colour,
// the rest muted with how far along they are. No ranking and nothing compared with other users.
export function BadgesCard() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const tripsPlanned = useCountsStore((state) => state.tripsPlanned);
  const checkIns = useCountsStore((state) => state.checkIns);
  const reports = useCountsStore((state) => state.reports);
  const gpsReports = useCountsStore((state) => state.gpsReports);
  const rides = useRidesStore((state) => state.rides);
  const badges = badgeStates(badgeCountsOf({ tripsPlanned, checkIns, reports, gpsReports }, rides));
  const earned = badges.filter((badge) => badge.earned).length;

  return (
    <Card>
      <View style={styles.head}>
        <Award color={colors.warning} size={ICON_SIZE} />
        <Text style={[typography.labelLg, styles.grow]}>{strings.badges.title(earned, badges.length)}</Text>
      </View>
      {badges.map((badge) => {
        const Icon = ICONS[badge.id];
        const name = strings.badges.names[badge.id];
        return (
          <View
            key={badge.id}
            style={styles.row}
            accessible
            accessibilityLabel={badge.earned ? strings.badges.earnedLabel(name) : strings.badges.progressLabel(name, badge.have, badge.need)}
          >
            <View style={[styles.tile, badge.earned ? styles.tileEarned : styles.tileMuted]}>
              <Icon color={badge.earned ? colors.warning : colors.textTertiary} size={ICON_SIZE} />
            </View>
            <View style={styles.grow}>
              <Text style={[typography.bodyMd, !badge.earned && styles.muted]}>{name}</Text>
              <Text style={typography.bodySm}>{strings.badges.hints[badge.id]}</Text>
            </View>
            <Text style={[typography.labelLg, badge.earned ? styles.done : styles.muted]}>
              {badge.earned ? strings.badges.done : strings.badges.progress(badge.have, badge.need)}
            </Text>
          </View>
        );
      })}
      <Text style={typography.bodySm}>{strings.badges.note}</Text>
    </Card>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  tile: {
    width: TILE,
    height: TILE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  tileEarned: {
    backgroundColor: colors.warningContainer,
  },
  tileMuted: {
    backgroundColor: colors.surfaceLow,
  },
  grow: {
    flex: 1,
  },
  muted: {
    color: colors.textSecondary,
  },
  done: {
    color: colors.success,
  },
}));

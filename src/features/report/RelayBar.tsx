import { RadioTower } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, IconTile } from '@/components';
import { LIVE_UI_REFRESH_INTERVAL_S } from '@/shared/config';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

import type { UplinkStatus } from './useGpsBroadcast';

const MS_PER_S = 1000;

type RelayBarProps = {
  routeCode: string;
  destination: string;
  // T1: whether the location reaches the live map
  uplink: UplinkStatus;
  onStop: () => void;
};

function uplinkText(uplink: UplinkStatus, nowMs: number): string {
  const t = strings.report.uplink;
  switch (uplink.kind) {
    case 'noVehicle':
      return t.noVehicle;
    case 'offTeam':
      return t.offTeam;
    case 'waiting':
      return t.waiting;
    case 'live':
      return t.live(Math.max(0, Math.round((nowMs - uplink.sentMs) / MS_PER_S)));
    case 'saved':
      return t.saved(uplink.count);
  }
}

// B4: shown on the Map while a relay shares the rider's location; it ends by itself at the destination
export function RelayBar({ routeCode, destination, uplink, onStop }: RelayBarProps) {
  const styles = useStyles();
  const { typography, elevation } = useTheme();
  const t = strings.report;
  const [nowMs, setNowMs] = useState(Date.now);
  const live = uplink.kind === 'live';

  // "sent 10 s ago" counts up while the marker is live
  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), LIVE_UI_REFRESH_INTERVAL_S * MS_PER_S);
    return () => clearInterval(timer);
  }, [live]);

  return (
    <View style={[styles.bar, elevation.level3]} accessibilityLiveRegion="polite">
      <IconTile icon={RadioTower} tone={uplink.kind === 'saved' ? 'warning' : 'success'} />
      <View style={styles.grow}>
        <Text style={typography.labelLg} numberOfLines={1}>
          {t.sharingTitle}
        </Text>
        <Text style={typography.bodySm} numberOfLines={1}>
          {t.sharingDetail(routeCode, destination)}
        </Text>
        <Text style={typography.bodySm} numberOfLines={1}>
          {uplinkText(uplink, Math.max(nowMs, live ? uplink.sentMs : 0))}
        </Text>
      </View>
      <Button label={t.stopSharing} variant="secondary" onPress={onStop} />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  grow: {
    flex: 1,
  },
}));

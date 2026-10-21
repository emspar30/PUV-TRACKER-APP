import { Redirect, Tabs } from 'expo-router';
import { Bus, Map, Radio, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { NoBackend } from '@/features/auth/NoBackend';
import { CheckInReminder } from '@/features/checkin/CheckInReminder';
import { useActiveCheckIn } from '@/features/checkin/useActiveCheckIn';
import { useConnectionProbe } from '@/features/connection/useConnectionProbe';
import { TourTarget } from '@/features/tour/TourTarget';
import { TAB_ROUTES, type TabRouteName } from '@/navigation/tabs';
import { entryRoute } from '@/shared/auth/gate';
import { useProfileStore } from '@/state/profileStore';
import { useSessionStore } from '@/state/sessionStore';
import { useTrackingStore } from '@/state/trackingStore';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

// Four tabs (restyle): Map, Check-in, My Rides, Crowdsource. Settings open from the top bar.
const ICONS: Record<TabRouteName, LucideIcon> = {
  index: Map,
  checkin: ShieldCheck,
  ride: Bus,
  crowdsource: Radio,
};

// ST2-D: the tabs the tips tour points at
const TOUR_TABS: Partial<Record<TabRouteName, 'checkin' | 'ride' | 'crowdsource'>> = {
  checkin: 'checkin',
  ride: 'ride',
  crowdsource: 'crowdsource',
};

const ICON_SIZE = spacing.lg - spacing.xs / 2;
const DOT_SIZE = spacing.sm + spacing.xs / 2;
const DOT_BORDER = 2;

export default function TabsLayout() {
  const onboarded = useProfileStore((state) => state.onboarded);
  const { colors } = useTheme();
  const styles = useStyles();
  // B3: a red dot on the Check-in icon while a check-in runs, seen from every tab
  const checkedIn = useActiveCheckIn() !== null;
  // CA1.1: and on the Map icon while the tracked multicab is near
  const trackedNear = useTrackingStore((state) => state.vehicleId !== null && state.near);
  const dotted = (name: TabRouteName) => (name === 'checkin' && checkedIn) || (name === 'index' && trackedNear);
  const status = useSessionStore((state) => state.status);
  // PRD 14: the offline banner in the top bar, on every tab
  useConnectionProbe();
  // AU1 (PRD 7.1): the introduction first, then an account is needed. A session saved on the phone
  // counts even offline, so a signed-in commuter is never sent to sign in without a network.
  const entry = entryRoute({ onboarded, status, dev: __DEV__ });
  if (entry === 'onboarding') return <Redirect href="/onboarding" />;
  if (entry === 'signIn') return <Redirect href={{ pathname: '/sign-in', params: { gate: '1' } }} />;
  if (entry === 'noBackend') return <NoBackend />;
  // The saved session is still being read: nothing, so the sign-in page does not flash
  if (entry === 'wait') return null;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.outline,
          },
          tabBarItemStyle: { paddingVertical: spacing.xs },
          tabBarLabelStyle: { fontWeight: '600' },
          sceneStyle: { backgroundColor: colors.canvas },
        }}
      >
        {TAB_ROUTES.map(({ name, title }) => {
          const Icon = ICONS[name];
          return (
            <Tabs.Screen
              key={name}
              name={name}
              options={{
                title,
                // The active tab is shown by colour only: its icon and label turn blue
                tabBarIcon: ({ color }) => {
                  const icon = (
                    <View>
                      <Icon color={color} size={ICON_SIZE} />
                      {dotted(name) ? <View style={styles.dot} /> : null}
                    </View>
                  );
                  const tourId = TOUR_TABS[name];
                  return tourId ? <TourTarget id={tourId}>{icon}</TourTarget> : icon;
                },
                tabBarAccessibilityLabel:
                  name === 'checkin' && checkedIn ? strings.tabs.checkinActive : name === 'index' && trackedNear ? strings.tabs.mapNear : undefined,
              }}
            />
          );
        })}
      </Tabs>
      <CheckInReminder />
    </>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  dot: {
    position: 'absolute',
    top: -DOT_BORDER,
    right: -DOT_BORDER,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radii.pill,
    borderWidth: DOT_BORDER,
    borderColor: colors.card,
    backgroundColor: colors.danger,
  },
}));

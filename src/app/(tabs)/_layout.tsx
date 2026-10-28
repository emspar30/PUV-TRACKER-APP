import { Redirect, Tabs } from 'expo-router';
import { Map, MapPinned, RadioTower, Route, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { NoBackend } from '@/features/auth/NoBackend';
import { CheckInReminder } from '@/features/checkin/CheckInReminder';
import { useActiveCheckIn } from '@/features/checkin/useActiveCheckIn';
import { RelaySheet } from '@/features/report/RelaySheet';
import { useConnectionProbe } from '@/features/connection/useConnectionProbe';
import { TourTarget } from '@/features/tour/TourTarget';
import { TAB_ROUTES, type TabRouteName } from '@/navigation/tabs';
import { TAB_BAR_HEIGHT, useTabBarSpace } from '@/navigation/useTabBarSpace';
import { entryRoute } from '@/shared/auth/gate';
import { useProfileStore } from '@/state/profileStore';
import { useRelayFormStore } from '@/state/relayFormStore';
import { useSessionStore } from '@/state/sessionStore';
import { useTrackingStore } from '@/state/trackingStore';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

// Four tabs (restyle): Map, Check-in, My Rides, Crowdsource, and Relay in the middle (Emjay's draft,
// 2026-10-26: icons only, these icons). Settings open from the top bar.
const ICONS: Record<TabRouteName, LucideIcon> = {
  index: Map,
  checkin: MapPinned,
  relay: RadioTower,
  ride: Route,
  crowdsource: Users,
};

// ST2-D: the tabs the tips tour points at
const TOUR_TABS: Partial<Record<TabRouteName, 'checkin' | 'relay' | 'ride' | 'crowdsource'>> = {
  checkin: 'checkin',
  relay: 'relay',
  ride: 'ride',
  crowdsource: 'crowdsource',
};

const ICON_SIZE = spacing.lg - spacing.xs / 2;
// The light blue pill behind the active icon
const PILL_WIDTH = ICON_SIZE + spacing.lg * 2;
const PILL_HEIGHT = ICON_SIZE + spacing.sm * 2;
const DOT_SIZE = spacing.sm + spacing.xs / 2;
const DOT_BORDER = 2;

export default function TabsLayout() {
  const onboarded = useProfileStore((state) => state.onboarded);
  const { colors, elevation } = useTheme();
  const styles = useStyles();
  const bar = useTabBarSpace();
  // B3: a red dot on the Check-in icon while a check-in runs, seen from every tab
  const checkedIn = useActiveCheckIn() !== null;
  // CA1.1: and on the Map icon while the tracked multicab is near
  const trackedNear = useTrackingStore((state) => state.vehicleId !== null && state.near);
  const dotted = (name: TabRouteName) => (name === 'checkin' && checkedIn) || (name === 'index' && trackedNear);
  const status = useSessionStore((state) => state.status);
  const relayFormOpen = useRelayFormStore((state) => state.open);
  const showRelayForm = useRelayFormStore((state) => state.show);
  const hideRelayForm = useRelayFormStore((state) => state.hide);
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
          // Emjay's draft (2026-10-26): a floating card like the top bar, icons only, the active one
          // on a light blue pill. Every tab runs under it and keeps its own content above it
          tabBarStyle: {
            position: 'absolute',
            // start and end, not left and right: the library pins the bar with start: 0 and end: 0,
            // which win over left and right
            start: spacing.md,
            end: spacing.md,
            bottom: bar.bottom,
            height: TAB_BAR_HEIGHT,
            paddingBottom: 0,
            paddingHorizontal: spacing.xs,
            // Emjay, 2026-10-26: the same solid colour and shadow as the round map buttons
            borderTopWidth: 0,
            borderRadius: radii.card,
            backgroundColor: colors.sheet,
            ...elevation.level2,
          },
          // The library's tab stacks from the top and fits the icon in a 31 by 28 box: each tab is
          // its own button instead, the pill centred in the bar
          tabBarIconStyle: { width: PILL_WIDTH, height: PILL_HEIGHT },
          tabBarButton: ({ children, onPress, onLongPress, accessibilityState, accessibilityLabel, testID }) => (
            <Pressable
              style={styles.tab}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={accessibilityState}
              accessibilityLabel={accessibilityLabel}
              testID={testID}
            >
              {children}
            </Pressable>
          ),
          tabBarShowLabel: false,
          sceneStyle: { backgroundColor: colors.canvas },
        }}
      >
        {TAB_ROUTES.map(({ name, title }) => {
          const Icon = ICONS[name];
          return (
            <Tabs.Screen
              key={name}
              name={name}
              // Relay is a button, not a screen: it opens the form over the tab the commuter is on
              listeners={
                name === 'relay'
                  ? {
                      tabPress: (event) => {
                        event.preventDefault();
                        showRelayForm();
                      },
                    }
                  : undefined
              }
              options={{
                title,
                // The active tab: its icon turns blue on a light blue pill
                tabBarIcon: ({ color, focused }) => {
                  const icon = (
                    <View style={[styles.pill, focused && styles.pillActive]}>
                      <View>
                        <Icon color={color} size={ICON_SIZE} />
                        {dotted(name) ? <View style={styles.dot} /> : null}
                      </View>
                    </View>
                  );
                  const tourId = TOUR_TABS[name];
                  return tourId ? <TourTarget id={tourId}>{icon}</TourTarget> : icon;
                },
                // No labels on the bar; screen readers still hear each tab's name
                tabBarAccessibilityLabel:
                  name === 'checkin' && checkedIn ? strings.tabs.checkinActive : name === 'index' && trackedNear ? strings.tabs.mapNear : title,
              }}
            />
          );
        })}
      </Tabs>
      <CheckInReminder />
      {relayFormOpen ? <RelaySheet onClose={hideRelayForm} /> : null}
    </>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  pillActive: {
    backgroundColor: colors.primaryContainer,
  },
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

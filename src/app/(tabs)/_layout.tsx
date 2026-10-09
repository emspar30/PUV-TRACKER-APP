import { Redirect, Tabs } from 'expo-router';
import { Bus, Lock, Map, Radio, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { promptSignIn, useIsGuest } from '@/features/auth/guestGate';
import { CheckInReminder } from '@/features/checkin/CheckInReminder';
import { useActiveCheckIn } from '@/features/checkin/useActiveCheckIn';
import { useConnectionProbe } from '@/features/connection/useConnectionProbe';
import { TourTarget } from '@/features/tour/TourTarget';
import { TAB_ROUTES, type TabRouteName } from '@/navigation/tabs';
import { useProfileStore } from '@/state/profileStore';
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

// ST2-D: tabs a guest cannot open (checking in, and the crowdsourced feed and relays)
const GUEST_LOCKED: readonly TabRouteName[] = ['checkin', 'crowdsource'];
const LOCKED_OPACITY = 0.45;

const ICON_SIZE = spacing.lg - spacing.xs / 2;
const LOCK_SIZE = spacing.md - spacing.xs / 2;
const DOT_SIZE = spacing.sm + spacing.xs / 2;
const DOT_BORDER = 2;

export default function TabsLayout() {
  const onboarded = useProfileStore((state) => state.onboarded);
  const { colors } = useTheme();
  const styles = useStyles();
  // B3: a red dot on the Check-in icon while a check-in runs, seen from every tab
  const checkedIn = useActiveCheckIn() !== null;
  const guest = useIsGuest();
  // PRD 14: the offline banner in the top bar, on every tab
  useConnectionProbe();
  // First launch: show the introduction before the tabs
  if (!onboarded) return <Redirect href="/onboarding" />;

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
          const locked = guest && GUEST_LOCKED.includes(name);
          return (
            <Tabs.Screen
              key={name}
              name={name}
              // ST2-D: a guest stays where they are and is asked to sign in
              listeners={{
                tabPress: (event) => {
                  if (!locked) return;
                  event.preventDefault();
                  promptSignIn();
                },
              }}
              options={{
                title,
                tabBarLabelStyle: locked ? { fontWeight: '600', opacity: LOCKED_OPACITY } : undefined,
                // The active tab is shown by colour only: its icon and label turn blue
                tabBarIcon: ({ color }) => {
                  const icon = (
                    <View>
                      <View style={locked ? styles.lockedIcon : undefined}>
                        <Icon color={color} size={ICON_SIZE} />
                      </View>
                      {name === 'checkin' && checkedIn ? <View style={styles.dot} /> : null}
                      {locked ? (
                        <View style={styles.lock}>
                          <Lock color={colors.card} size={LOCK_SIZE - spacing.xs / 2} />
                        </View>
                      ) : null}
                    </View>
                  );
                  const tourId = TOUR_TABS[name];
                  return tourId ? <TourTarget id={tourId}>{icon}</TourTarget> : icon;
                },
                tabBarAccessibilityLabel: locked
                  ? strings.guest.locked(title)
                  : name === 'checkin' && checkedIn
                    ? strings.tabs.checkinActive
                    : undefined,
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
  lockedIcon: {
    opacity: LOCKED_OPACITY,
  },
  lock: {
    position: 'absolute',
    right: -spacing.xs - spacing.xs / 2,
    bottom: -spacing.xs / 2,
    width: LOCK_SIZE,
    height: LOCK_SIZE,
    borderRadius: LOCK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textSecondary,
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

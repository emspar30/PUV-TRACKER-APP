import { Redirect, Tabs } from 'expo-router';
import { Bus, Map, Radio, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { CheckInReminder } from '@/features/checkin/CheckInReminder';
import { useActiveCheckIn } from '@/features/checkin/useActiveCheckIn';
import { useConnectionProbe } from '@/features/connection/useConnectionProbe';
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

const ICON_SIZE = spacing.lg - spacing.xs / 2;
const DOT_SIZE = spacing.sm + spacing.xs / 2;
const DOT_BORDER = 2;

export default function TabsLayout() {
  const onboarded = useProfileStore((state) => state.onboarded);
  const { colors } = useTheme();
  const styles = useStyles();
  // B3: a red dot on the Check-in icon while a check-in runs, seen from every tab
  const checkedIn = useActiveCheckIn() !== null;
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
          return (
            <Tabs.Screen
              key={name}
              name={name}
              options={{
                title,
                // The active tab is shown by colour only: its icon and label turn blue
                tabBarIcon: ({ color }) => (
                  <View>
                    <Icon color={color} size={ICON_SIZE} />
                    {name === 'checkin' && checkedIn ? <View style={styles.dot} /> : null}
                  </View>
                ),
                tabBarAccessibilityLabel: name === 'checkin' && checkedIn ? strings.tabs.checkinActive : undefined,
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

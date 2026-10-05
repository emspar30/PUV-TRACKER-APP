import { Redirect, Tabs } from 'expo-router';
import { Bus, Map, Radio, ShieldCheck, type LucideIcon } from 'lucide-react-native';

import { TAB_ROUTES, type TabRouteName } from '@/navigation/tabs';
import { useProfileStore } from '@/state/profileStore';
import { spacing, useTheme } from '@/theme';

// Four tabs (restyle): Map, Check-in, My Rides, Crowdsource. Settings open from the top bar.
const ICONS: Record<TabRouteName, LucideIcon> = {
  index: Map,
  checkin: ShieldCheck,
  ride: Bus,
  crowdsource: Radio,
};

const ICON_SIZE = spacing.lg - spacing.xs / 2;

export default function TabsLayout() {
  const onboarded = useProfileStore((state) => state.onboarded);
  const { colors } = useTheme();
  // First launch: show the introduction before the tabs
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
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
              tabBarIcon: ({ color }) => <Icon color={color} size={ICON_SIZE} />,
            }}
          />
        );
      })}
    </Tabs>
  );
}

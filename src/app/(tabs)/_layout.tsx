import { Redirect, Tabs } from 'expo-router';
import { Compass, MapPin, Route, type LucideIcon } from 'lucide-react-native';

import { TAB_ROUTES, type TabRouteName } from '@/navigation/tabs';
import { useProfileStore } from '@/state/profileStore';
import { spacing, useTheme } from '@/theme';

// Three tabs (plan v2, Revision 2); the fare is part of My Ride. Settings open from the avatar
// button on each tab.
const ICONS: Record<TabRouteName, LucideIcon> = {
  index: Compass,
  checkin: MapPin,
  ride: Route,
};

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
          backgroundColor: colors.sheet,
          borderTopColor: colors.outline,
        },
        tabBarItemStyle: { paddingVertical: spacing.xs },
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
              tabBarIcon: ({ color, size }) => <Icon color={color} size={size} />,
            }}
          />
        );
      })}
    </Tabs>
  );
}

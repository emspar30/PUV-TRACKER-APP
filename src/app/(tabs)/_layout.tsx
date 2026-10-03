import { Tabs } from 'expo-router';
import { MapPin, Route, User, type LucideIcon } from 'lucide-react-native';

import { colors, spacing } from '@/theme';

type TabConfig = {
  name: string;
  title: string;
  icon: LucideIcon;
};

const TABS: TabConfig[] = [
  { name: 'index', title: 'Map', icon: MapPin },
  { name: 'plan', title: 'Plan', icon: Route },
  { name: 'profile', title: 'Profile', icon: User },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarItemStyle: { paddingVertical: spacing.xs },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      {TABS.map(({ name, title, icon: Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size }) => <Icon color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}

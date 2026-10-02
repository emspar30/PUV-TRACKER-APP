import { Redirect, Tabs } from 'expo-router';
import { MapPin, Route, User, type LucideIcon } from 'lucide-react-native';

import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { colors, spacing } from '@/theme';

type TabConfig = {
  name: string;
  title: string;
  icon: LucideIcon;
};

const TABS: TabConfig[] = [
  { name: 'index', title: strings.tabs.map, icon: MapPin },
  { name: 'plan', title: strings.tabs.plan, icon: Route },
  { name: 'profile', title: strings.tabs.profile, icon: User },
];

export default function TabsLayout() {
  const onboarded = useProfileStore((state) => state.onboarded);
  // First launch: show the introduction before the tabs
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surface,
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

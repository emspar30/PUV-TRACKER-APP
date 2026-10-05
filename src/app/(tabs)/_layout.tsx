import { Redirect, Tabs } from 'expo-router';
import { Bus, Map, Radio, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { TAB_ROUTES, type TabRouteName } from '@/navigation/tabs';
import { useProfileStore } from '@/state/profileStore';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

// Four tabs (restyle): Map, Check-in, My Rides, Crowdsource. Settings open from the top bar.
const ICONS: Record<TabRouteName, LucideIcon> = {
  index: Map,
  checkin: ShieldCheck,
  ride: Bus,
  crowdsource: Radio,
};

const ICON_SIZE = spacing.lg - spacing.xs / 2;
const INDICATOR_WIDTH = spacing.xl * 2;
const INDICATOR_HEIGHT = spacing.xl;

export default function TabsLayout() {
  const styles = useStyles();
  const onboarded = useProfileStore((state) => state.onboarded);
  const { colors } = useTheme();
  // First launch: show the introduction before the tabs
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onPrimaryContainer,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
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
              // Material 3: the active tab's icon sits in a tinted pill
              tabBarIcon: ({ color, focused }) => (
                <View style={[styles.indicator, focused && styles.indicatorOn]}>
                  <Icon color={color} size={ICON_SIZE} />
                </View>
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  indicator: {
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  indicatorOn: {
    backgroundColor: colors.primaryContainer,
  },
}));

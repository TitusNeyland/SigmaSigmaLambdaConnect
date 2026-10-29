import { Tabs, useRouter } from 'expo-router';

import { palette } from '@/theme';
import { TabIcon, type TabName } from '@/ui/TabIcon';

/** The routes the tab bar shows, in order. */
export const TABS: readonly { name: TabName; title: string }[] = [
  { name: 'home', title: 'Home' },
  { name: 'events', title: 'Events' },
  { name: 'post', title: 'Post' },
  { name: 'chapter', title: 'Chapter' },
  { name: 'profile', title: 'Profile' },
];

/** Where the Post tab goes. It opens as a modal over the tabs instead of switching tabs. */
export const NEW_POST_ROUTE = '/new-post';

export function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.ink,
        tabBarInactiveTintColor: palette.secondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTopColor: palette.separator,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarLabel: tab.title,
            tabBarAccessibilityLabel: tab.name === 'post' ? 'Create a post' : tab.title,
            tabBarButtonTestID: `tab-${tab.name}`,
            tabBarIcon: ({ focused }) => <TabIcon name={tab.name} focused={focused} />,
          }}
          listeners={
            tab.name === 'post'
              ? {
                  tabPress: (event) => {
                    event.preventDefault();
                    router.push(NEW_POST_ROUTE);
                  },
                }
              : undefined
          }
        />
      ))}
    </Tabs>
  );
}

import { Stack } from 'expo-router';

// The profile is always under anything opened in this tab, even from another tab (like Home's
// welcome card opening Edit profile), so leaving lands on it and the tab never gets stuck.
export const unstable_settings = { anchor: 'index' };

// Each tab has its own stack, so going deeper in one tab doesn't affect the others.
export default function TabStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

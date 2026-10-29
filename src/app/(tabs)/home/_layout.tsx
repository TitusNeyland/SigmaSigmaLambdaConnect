import { Stack } from 'expo-router';

// Opening a post from a link still puts the feed underneath it, so Back works.
export const unstable_settings = { initialRouteName: 'index' };

// Each tab has its own stack, so going deeper in one tab doesn't affect the others.
export default function TabStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

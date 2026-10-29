import { Stack } from 'expo-router';

// Opening an event from a link still puts the Events list underneath it, so Back works.
export const unstable_settings = { initialRouteName: 'index' };

// Each tab has its own stack, so going deeper in one tab doesn't affect the others.
export default function TabStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

import { Stack } from 'expo-router';

// Each tab has its own stack, so going deeper in one tab doesn't affect the others.
export default function TabStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

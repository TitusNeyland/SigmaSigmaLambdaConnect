import { Stack } from 'expo-router';

import { radius } from '@/theme';

// Opening a post from a link still puts the feed underneath it, so Back works.
export const unstable_settings = { anchor: 'index' };

// Each tab has its own stack, so going deeper in one tab doesn't affect the others.
export default function TabStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Comments open in a sheet over the feed, Instagram style: about 60% tall, drag up
          for full height, swipe down to close. */}
      <Stack.Screen
        name="comments/[id]"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: radius.sheet,
        }}
      />
    </Stack>
  );
}

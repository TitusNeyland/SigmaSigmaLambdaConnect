import { Stack } from 'expo-router';

import { GuidelinesGate } from '@/features/guidelines/GuidelinesGate';
import { PostDraftProvider } from '@/features/post/draft';

// The posting flow, Instagram style: pick photos, edit them, then caption and share. Members agree to the
// guidelines first (#38).
// The draft lives here so it survives opening the guidelines from the compose screen.
export default function NewPostLayout() {
  return (
    <GuidelinesGate>
      <PostDraftProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {/* The photo spans the screen, so an edge swipe moves the photo, not back a step. */}
          <Stack.Screen name="edit" options={{ gestureEnabled: false }} />
        </Stack>
      </PostDraftProvider>
    </GuidelinesGate>
  );
}

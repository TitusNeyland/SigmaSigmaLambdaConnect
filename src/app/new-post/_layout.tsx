import { Stack } from 'expo-router';

import { GuidelinesGate } from '@/features/guidelines/GuidelinesGate';
import { PostDraftProvider } from '@/features/post/draft';

// The posting flow: one compose screen with photos, caption and tags. Members agree to the
// guidelines first (#38).
// The draft lives here so it survives opening the guidelines from the compose screen.
export default function NewPostLayout() {
  return (
    <GuidelinesGate>
      <PostDraftProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </PostDraftProvider>
    </GuidelinesGate>
  );
}

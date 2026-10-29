import { Stack } from 'expo-router';

import { GuidelinesGate } from '@/features/guidelines/GuidelinesGate';
import { PostDraftProvider } from '@/features/post/draft';

// The posting flow: pick photos, then compose. Members agree to the guidelines first (#38).
// The draft lives here so both steps share it.
export default function NewPostLayout() {
  return (
    <GuidelinesGate>
      <PostDraftProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </PostDraftProvider>
    </GuidelinesGate>
  );
}

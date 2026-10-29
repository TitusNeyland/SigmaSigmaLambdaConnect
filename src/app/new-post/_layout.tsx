import { Stack } from 'expo-router';

import { PostDraftProvider } from '@/features/post/draft';

// The posting flow: pick photos, then compose. The draft lives here so both steps share it.
export default function NewPostLayout() {
  return (
    <PostDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </PostDraftProvider>
  );
}

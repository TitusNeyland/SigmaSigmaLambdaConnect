import { useLocalSearchParams } from 'expo-router';

import { PostDetailScreen } from '@/features/feed/PostDetailScreen';

// A post opened from an event's photos, so Back returns to the event.
export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostDetailScreen id={id} />;
}

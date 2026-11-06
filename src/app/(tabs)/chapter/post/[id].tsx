import { useLocalSearchParams } from 'expo-router';

import { PostDetailScreen } from '@/features/feed/PostDetailScreen';

// A post opened from a brother's profile, so Back returns there instead of jumping to Home.
export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostDetailScreen id={id} />;
}

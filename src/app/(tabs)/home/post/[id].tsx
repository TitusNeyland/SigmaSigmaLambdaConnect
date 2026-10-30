import { useLocalSearchParams } from 'expo-router';

import { PostDetailScreen } from '@/features/feed/PostDetailScreen';

export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostDetailScreen id={id} />;
}

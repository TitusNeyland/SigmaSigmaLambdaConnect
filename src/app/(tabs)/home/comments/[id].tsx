import { useLocalSearchParams } from 'expo-router';

import { CommentsSheetScreen } from '@/features/feed/CommentsSheetScreen';

export default function CommentsSheetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CommentsSheetScreen id={id} />;
}

import { router, useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/features/navigation/PlaceholderScreen';
import { Button } from '@/ui';

// Stand-in until #34 builds post detail and comments.
export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PlaceholderScreen title="Post" note={`Comments for ${id} are built in #34.`}>
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </PlaceholderScreen>
  );
}

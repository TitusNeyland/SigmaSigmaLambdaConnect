import { router, useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/features/navigation/PlaceholderScreen';
import { Button } from '@/ui';

// Stand-in until #18 builds another member's profile.
export default function MemberProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return (
    <PlaceholderScreen title="Brother" note={`Profile for ${uid} is built in #18.`}>
      <Button title="Back to directory" variant="secondary" onPress={() => router.back()} />
    </PlaceholderScreen>
  );
}

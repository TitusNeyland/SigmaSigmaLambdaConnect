import { router } from 'expo-router';

import { PlaceholderScreen } from '@/features/navigation/PlaceholderScreen';
import { Button } from '@/ui';

// Stand-in until its issue is built. Linked from the leadership home (#46).
export default function Route() {
  return (
    <PlaceholderScreen title="Take attendance" note="Check members in at an event. Built in #49.">
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </PlaceholderScreen>
  );
}

import { router } from 'expo-router';

import { PlaceholderScreen } from '@/features/navigation/PlaceholderScreen';
import { Button } from '@/ui';

// Stand-in until its issue is built. Linked from the leadership home (#46).
export default function Route() {
  return (
    <PlaceholderScreen
      title="Membership requests"
      note="Approve or decline new accounts. Built in #48."
    >
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </PlaceholderScreen>
  );
}

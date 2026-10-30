import { router } from 'expo-router';

import { PlaceholderScreen } from '@/features/navigation/PlaceholderScreen';
import { Button } from '@/ui';

// Stand-in until #46 builds the leadership home.
export default function LeadershipRoute() {
  return (
    <PlaceholderScreen
      title="Leadership"
      note="KPIs, approvals and reports are built in #46 to #50."
    >
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </PlaceholderScreen>
  );
}

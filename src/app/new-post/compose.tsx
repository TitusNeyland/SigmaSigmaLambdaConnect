import { router } from 'expo-router';

import { PlaceholderScreen } from '@/features/navigation/PlaceholderScreen';
import { Button } from '@/ui';

// Stand-in until #32 builds the caption and share step.
export default function ComposeRoute() {
  return (
    <PlaceholderScreen title="Caption" note="Writing a caption and sharing are built in #32.">
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </PlaceholderScreen>
  );
}

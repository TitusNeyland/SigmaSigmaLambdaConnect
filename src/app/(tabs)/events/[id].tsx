import { router, useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/features/navigation/PlaceholderScreen';
import { Button } from '@/ui';

// Stand-in until #22 builds event details and #23 adds RSVP.
export default function EventDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PlaceholderScreen title="Event" note={`Details for ${id} are built in #22.`}>
      <Button title="Back to events" variant="secondary" onPress={() => router.back()} />
    </PlaceholderScreen>
  );
}

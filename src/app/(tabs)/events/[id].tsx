import { useLocalSearchParams } from 'expo-router';

import { EventDetailScreen } from '@/features/events/EventDetailScreen';

export default function EventDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventDetailScreen id={id} />;
}

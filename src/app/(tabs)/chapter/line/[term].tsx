import { useLocalSearchParams } from 'expo-router';

import { LineScreen } from '@/features/directory/LineScreen';

export default function LineRoute() {
  const { term } = useLocalSearchParams<{ term: string }>();
  return <LineScreen term={String(term ?? '')} />;
}

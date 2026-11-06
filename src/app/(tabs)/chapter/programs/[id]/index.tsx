import { useLocalSearchParams } from 'expo-router';

import { ProgramDetailScreen } from '@/features/programs/ProgramDetailScreen';

export default function ProgramRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProgramDetailScreen id={id} />;
}

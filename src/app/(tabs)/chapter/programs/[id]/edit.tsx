import { useLocalSearchParams } from 'expo-router';

import { ProgramFormScreen } from '@/features/programs/ProgramFormScreen';

export default function EditProgramRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProgramFormScreen id={id} />;
}

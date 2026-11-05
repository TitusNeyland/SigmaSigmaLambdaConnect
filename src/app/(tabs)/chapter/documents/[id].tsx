import { useLocalSearchParams } from 'expo-router';

import { ReportDetailScreen } from '@/features/documents/ReportDetailScreen';

export default function ReportDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReportDetailScreen id={id} />;
}

import { useLocalSearchParams } from 'expo-router';

import { PhotoEditorScreen } from '@/features/post/PhotoEditorScreen';

export default function PhotoEditorRoute() {
  const { photo } = useLocalSearchParams<{ photo?: string }>();
  return <PhotoEditorScreen start={Number(photo) || 0} />;
}

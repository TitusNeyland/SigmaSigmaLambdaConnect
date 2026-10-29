import { useLocalSearchParams } from 'expo-router';

import { MemberProfileScreen } from '@/features/profile/MemberProfileScreen';

export default function MemberProfileRoute() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <MemberProfileScreen uid={uid} />;
}

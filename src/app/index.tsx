import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';

export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  return <Redirect href={status === 'signedIn' ? '/home' : '/welcome'} />;
}

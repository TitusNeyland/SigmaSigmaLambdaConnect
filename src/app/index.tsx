import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';

export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signedIn') return <Redirect href="/home" />;
  if (status === 'unverified') return <Redirect href="/verify-email" />;
  return <Redirect href="/welcome" />;
}

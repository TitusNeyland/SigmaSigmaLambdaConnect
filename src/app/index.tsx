import { Redirect } from 'expo-router';

import { routeForStatus } from '@/features/auth/routes';
import { useSession } from '@/features/auth/session';

export default function Index() {
  const { status } = useSession();
  if (status === 'loading') return null;
  return <Redirect href={routeForStatus(status)} />;
}

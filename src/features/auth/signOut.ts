import { signOut } from '@/data/auth';
import { unregisterPush } from '@/features/notifications/registerForPush';

/** Signs out and stops this phone getting the member's notifications. */
export async function signOutHere(): Promise<void> {
  await unregisterPush();
  await signOut();
}

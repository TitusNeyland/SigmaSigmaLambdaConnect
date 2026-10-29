import Constants from 'expo-constants';
import * as Device from 'expo-device';
import {
  AndroidImportance,
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Platform } from 'react-native';

import { removePushToken, savePushToken } from '@/data/push';

export type PushRegistration =
  /** Token saved; this phone gets the member's notifications. */
  | 'registered'
  /** The member said no, now or before. We don't ask again; they can change it in iOS or Android settings. */
  | 'denied'
  /** Simulator, web, or no EAS project ID yet (run `eas init`). */
  | 'unsupported'
  | 'failed';

/** Android 13+ needs a channel before the permission prompt can show. */
export const ANDROID_CHANNEL = 'default';

// Shown while the app is open: a banner and a list entry, quietly.
setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let current: { uid: string; token: string } | null = null;

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/**
 * Asks for notification permission (once) and saves this phone's push token for the member.
 * Called after sign in, never at first launch.
 */
export async function registerForPush(uid: string): Promise<PushRegistration> {
  if (!Device.isDevice || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
    return 'unsupported';
  }
  const id = projectId();
  if (!id) return 'unsupported';
  try {
    if (Platform.OS === 'android') {
      await setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Chapter updates',
        importance: AndroidImportance.DEFAULT,
      });
    }
    let permission = await getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await requestPermissionsAsync();
    }
    if (!permission.granted) return 'denied';

    const { data: token } = await getExpoPushTokenAsync({ projectId: id });
    await savePushToken(uid, token, Platform.OS);
    current = { uid, token };
    return 'registered';
  } catch {
    return 'failed';
  }
}

/** Removes this phone's token on sign out. Best effort: signing out never waits on it failing. */
export async function unregisterPush(): Promise<void> {
  const last = current;
  current = null;
  if (!last) return;
  await removePushToken(last.uid, last.token).catch(() => {});
}

/** For tests. */
export function resetPushRegistration() {
  current = null;
}

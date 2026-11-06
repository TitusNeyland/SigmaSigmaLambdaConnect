import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What the welcome card on Home remembers, on this phone only: whether the member closed it,
 * and whether they've opened their check-in code. Losing it (a new phone) just shows the
 * card again, which is harmless.
 */
const dismissedKey = (uid: string) => `welcome:dismissed:${uid}`;
const codeSeenKey = (uid: string) => `welcome:code-seen:${uid}`;

async function read(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === '1';
  } catch {
    return false;
  }
}

async function write(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, '1');
  } catch {
    // Best effort: the card shows again next time.
  }
}

export const welcomeDismissed = (uid: string) => read(dismissedKey(uid));
export const dismissWelcome = (uid: string) => write(dismissedKey(uid));
export const checkInCodeSeen = (uid: string) => read(codeSeenKey(uid));
export const markCheckInCodeSeen = (uid: string) => write(codeSeenKey(uid));

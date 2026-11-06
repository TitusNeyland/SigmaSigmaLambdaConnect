import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback } from 'react';

/**
 * While this screen is open, the posting sheet doesn't close on a swipe down, so dragging a
 * photo down moves the photo instead of the sheet. Back still leaves.
 */
export function useHoldSheet() {
  const navigation = useNavigation();
  useFocusEffect(
    useCallback(() => {
      // The posting flow is its own stack, shown as a sheet by the screen around it.
      const sheet = navigation.getParent();
      sheet?.setOptions({ gestureEnabled: false });
      return () => sheet?.setOptions({ gestureEnabled: true });
    }, [navigation]),
  );
}

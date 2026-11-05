import { useEffect, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom padding for a bar at the bottom of the screen: clear of the home indicator when the
 * keyboard is closed, and sitting right on top of the keyboard when it's open.
 */
export function keyboardPadding(keyboardHeight: number, bottomInset: number): number {
  return Math.round(Math.max(keyboardHeight, bottomInset, 0));
}

/**
 * Bottom padding that keeps a screen's bottom bar (like a comment box) sitting right on the
 * keyboard, Instagram style. Use it on a view that reaches the very bottom of the screen,
 * with no SafeAreaView bottom edge around it: this padding covers the home indicator too.
 * Native sheets qualify, since their bottom always sits at the bottom of the screen, and
 * they don't reliably report the home-indicator inset themselves.
 *
 * On iOS the bar rises with the keyboard's own animation.
 */
export function useKeyboardInset(): number {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const animate = (e: KeyboardEvent) => {
      if (ios && e.duration) {
        LayoutAnimation.configureNext({
          duration: e.duration,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
    };
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      animate(e);
      setHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      animate(e);
      setHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return keyboardPadding(height, insets.bottom);
}

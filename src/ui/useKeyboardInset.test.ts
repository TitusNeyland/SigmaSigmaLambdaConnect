import { act, renderHook } from '@testing-library/react-native';
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from 'react-native';

import { keyboardPadding, useKeyboardInset } from './useKeyboardInset';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

describe('keyboardPadding', () => {
  it('is the full keyboard height when the keyboard is open', () => {
    expect(keyboardPadding(336, 34)).toBe(336);
    expect(keyboardPadding(300, 0)).toBe(300);
  });

  it('keeps clear of the home indicator when the keyboard is closed', () => {
    expect(keyboardPadding(0, 34)).toBe(34);
    expect(keyboardPadding(0, 0)).toBe(0);
  });
});

describe('useKeyboardInset', () => {
  type Listener = (e: KeyboardEvent) => void;
  let listeners: Record<string, Listener>;
  const keyboard = (height: number) =>
    ({
      duration: 250,
      endCoordinates: { height, screenY: 844 - height, screenX: 0, width: 390 },
    }) as KeyboardEvent;

  beforeEach(() => {
    listeners = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, fn: Listener) => {
      listeners[event] = fn;
      return { remove: jest.fn() };
    }) as never);
    jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('on iOS, rises with the keyboard as it starts to open, and drops as it closes', async () => {
    Platform.OS = 'ios';
    const { result } = await renderHook(() => useKeyboardInset());
    expect(result.current).toBe(34);
    await act(async () => listeners.keyboardWillShow(keyboard(336)));
    expect(result.current).toBe(336);
    // Moves in step with the keyboard's own animation.
    expect(LayoutAnimation.configureNext).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 250 }),
    );
    await act(async () => listeners.keyboardWillHide(keyboard(0)));
    expect(result.current).toBe(34);
  });

  it('on Android, follows the keyboard once it has opened and closed', async () => {
    Platform.OS = 'android';
    const { result } = await renderHook(() => useKeyboardInset());
    await act(async () => listeners.keyboardDidShow(keyboard(300)));
    expect(result.current).toBe(300);
    await act(async () => listeners.keyboardDidHide(keyboard(0)));
    expect(result.current).toBe(34);
    Platform.OS = 'ios';
  });
});

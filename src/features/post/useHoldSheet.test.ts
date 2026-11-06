import { renderHook } from '@testing-library/react-native';

import { useHoldSheet } from './useHoldSheet';

const mockSetOptions = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useNavigation: () => ({ getParent: () => ({ setOptions: mockSetOptions }) }),
    // Focused while mounted.
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});

it('keeps the sheet from swiping closed while open, and lets it again after', async () => {
  const { unmount } = await renderHook(() => useHoldSheet());
  expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
  await unmount();
  expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
});

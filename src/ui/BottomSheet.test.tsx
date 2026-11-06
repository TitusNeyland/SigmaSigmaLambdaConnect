import { act, render, screen } from '@testing-library/react-native';
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  type KeyboardEvent,
} from 'react-native';

import { spacing } from '@/theme';

import { BottomSheet } from './BottomSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

type Listener = (e: KeyboardEvent) => void;
let listeners: Record<string, Listener>;
const keyboard = (height: number) =>
  ({
    duration: 250,
    endCoordinates: { height, screenY: 844 - height, screenX: 0, width: 390 },
  }) as KeyboardEvent;
const os = Platform.OS;

beforeEach(() => {
  listeners = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, fn: Listener) => {
    listeners[event] = fn;
    return { remove: jest.fn() };
  }) as never);
  jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  Platform.OS = os;
});

const bottomPadding = () =>
  StyleSheet.flatten(screen.getByTestId('sheet-sheet').props.style).paddingBottom;

async function openSheet() {
  await render(
    <BottomSheet visible onClose={() => {}} title="Delete your account?" testID="sheet">
      <Text>Password</Text>
    </BottomSheet>,
  );
}

it('on iOS, rides up on top of the keyboard so a field in it stays in view', async () => {
  Platform.OS = 'ios';
  await openSheet();
  // Closed: clear of the home indicator.
  expect(bottomPadding()).toBe(34 + spacing.sm);
  await act(async () => listeners.keyboardWillShow(keyboard(336)));
  expect(bottomPadding()).toBe(336 + spacing.sm);
  await act(async () => listeners.keyboardWillHide(keyboard(0)));
  expect(bottomPadding()).toBe(34 + spacing.sm);
});

it('on Android, leaves it to the system, which resizes the sheet itself', async () => {
  Platform.OS = 'android';
  await openSheet();
  await act(async () => listeners.keyboardDidShow?.(keyboard(300)));
  expect(bottomPadding()).toBe(34 + spacing.sm);
});

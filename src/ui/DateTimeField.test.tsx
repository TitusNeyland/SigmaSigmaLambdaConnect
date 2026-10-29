import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { DateTimeField, formatDateTime } from './DateTimeField';

const VALUE = new Date(2026, 10, 7, 19, 0);

afterEach(() => {
  Platform.OS = 'ios';
});

it('formats for people and screen readers', () => {
  expect(formatDateTime(VALUE)).toBe('Sat, Nov 7, 7:00 PM');
  expect(formatDateTime(new Date(2026, 0, 1, 0, 5))).toBe('Thu, Jan 1, 12:05 AM');
});

it('on iOS, reports a picked date and ignores a dismissal', async () => {
  const onChange = jest.fn();
  await render(<DateTimeField label="Starts" value={VALUE} onChange={onChange} testID="f" />);
  const picker = screen.getByTestId('f');
  expect(picker.props.accessibilityLabel).toBe('Starts, Sat, Nov 7, 7:00 PM');
  const picked = new Date(2026, 10, 8, 18);
  picker.props.onChange({ type: 'set' }, picked);
  picker.props.onChange({ type: 'dismissed' }, undefined);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(picked);
});

it('on Android, asks for the date then the time', async () => {
  Platform.OS = 'android';
  const onChange = jest.fn();
  await render(<DateTimeField label="Starts" value={VALUE} onChange={onChange} testID="f" />);
  fireEvent.press(screen.getByRole('button', { name: 'Starts, Sat, Nov 7, 7:00 PM' }));
  const open = jest.mocked(DateTimePickerAndroid.open);
  expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'date', value: VALUE }));

  const day = new Date(2026, 10, 9, 19);
  open.mock.calls.at(-1)![0].onChange!({ type: 'set' } as never, day);
  expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'time', value: day }));

  const time = new Date(2026, 10, 9, 20, 30);
  open.mock.calls.at(-1)![0].onChange!({ type: 'set' } as never, time);
  expect(onChange).toHaveBeenCalledWith(time);
});

it('on Android, does nothing if the date dialog is dismissed', async () => {
  Platform.OS = 'android';
  const onChange = jest.fn();
  await render(<DateTimeField label="Starts" value={VALUE} onChange={onChange} />);
  fireEvent.press(screen.getByRole('button'));
  const open = jest.mocked(DateTimePickerAndroid.open);
  const calls = open.mock.calls.length;
  open.mock.calls.at(-1)![0].onChange!({ type: 'dismissed' } as never, undefined);
  expect(open.mock.calls.length).toBe(calls);
  expect(onChange).not.toHaveBeenCalled();
});

it('shows an error', async () => {
  await render(
    <DateTimeField label="Ends" value={VALUE} onChange={jest.fn()} error="Too early" testID="e" />,
  );
  expect(screen.getByTestId('e-error')).toHaveTextContent('Too early');
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { SegmentedControl } from './SegmentedControl';

const SEGMENTS = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
] as const;

it('can start with nothing selected', async () => {
  const onChange = jest.fn();
  await render(
    <SegmentedControl
      segments={SEGMENTS}
      value={null}
      onChange={onChange}
      accessibilityLabel="RSVP"
    />,
  );
  for (const tab of screen.getAllByRole('tab')) {
    expect(tab.props.accessibilityState).toMatchObject({ selected: false });
  }
  fireEvent.press(screen.getByRole('tab', { name: 'Maybe' }));
  expect(onChange).toHaveBeenCalledWith('maybe');
});

it('shows the choice but ignores taps when disabled', async () => {
  const onChange = jest.fn();
  await render(
    <SegmentedControl
      segments={SEGMENTS}
      value="going"
      onChange={onChange}
      accessibilityLabel="RSVP"
      disabled
    />,
  );
  const maybe = screen.getByRole('tab', { name: 'Maybe' });
  expect(maybe.props.accessibilityState).toMatchObject({ selected: false, disabled: true });
  expect(screen.getByRole('tab', { name: 'Going' }).props.accessibilityState).toMatchObject({
    selected: true,
  });
  fireEvent.press(maybe);
  expect(onChange).not.toHaveBeenCalled();
});

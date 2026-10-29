import { fireEvent, render, screen } from '@testing-library/react-native';

import { FilterChips, NavHeader, SearchField } from '@/ui';

describe('SearchField', () => {
  it('uses its label as placeholder and accessibility label, and reports typing', async () => {
    const onChangeText = jest.fn();
    await render(<SearchField value="" onChangeText={onChangeText} label="Search" testID="s" />);
    const input = screen.getByLabelText('Search');
    expect(input.props.placeholder).toBe('Search');
    fireEvent.changeText(input, 'reed');
    expect(onChangeText).toHaveBeenCalledWith('reed');
  });

  it('shows a clear button only when there is text, and clearing empties it', async () => {
    const onChangeText = jest.fn();
    const { rerender } = await render(
      <SearchField value="" onChangeText={onChangeText} label="Search" testID="s" />,
    );
    expect(screen.queryByLabelText('Clear search')).toBeNull();
    await rerender(
      <SearchField value="reed" onChangeText={onChangeText} label="Search" testID="s" />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChangeText).toHaveBeenCalledWith('');
  });
});

describe('FilterChips', () => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'officers', label: 'Officers' },
  ] as const;

  it('marks the selected chip and reports a new choice', async () => {
    const onChange = jest.fn();
    await render(
      <FilterChips
        options={options}
        value="all"
        onChange={onChange}
        accessibilityLabel="Filter"
        testID="f"
      />,
    );
    expect(screen.getByTestId('f-all').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('f-officers').props.accessibilityState).toMatchObject({
      selected: false,
    });
    fireEvent.press(screen.getByRole('button', { name: 'Officers' }));
    expect(onChange).toHaveBeenCalledWith('officers');
  });
});

describe('NavHeader', () => {
  it('has a back button and an optional header title', async () => {
    const onBack = jest.fn();
    const { rerender } = await render(<NavHeader title="Settings" onBack={onBack} />);
    expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
    await rerender(<NavHeader onBack={onBack} />);
    expect(screen.queryByRole('header')).toBeNull();
  });
});

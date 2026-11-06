import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { colors, palette } from '@/theme';

import { FilterChips } from './FilterChips';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'officers', label: 'Officers' },
] as const;

const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

it('shows gray pills by default, and white bordered ones on a grouped background', async () => {
  await render(
    <FilterChips
      options={OPTIONS}
      value="all"
      onChange={() => {}}
      accessibilityLabel="Filter"
      testID="plain"
    />,
  );
  expect(style('plain-officers').backgroundColor).toBe(colors.fill);
  expect(style('plain-all').backgroundColor).toBe(palette.ink);

  await render(
    <FilterChips
      options={OPTIONS}
      value="all"
      onChange={() => {}}
      accessibilityLabel="Filter"
      tone="card"
      testID="card"
    />,
  );
  // Visible on the gray directory background, unlike the default gray.
  expect(style('card-officers')).toMatchObject({
    backgroundColor: colors.surface,
    borderColor: colors.separator,
  });
});

it('with an inset, scrolls to the screen’s edges and still lines up with the content', async () => {
  await render(
    <FilterChips
      options={OPTIONS}
      value="all"
      onChange={() => {}}
      accessibilityLabel="Filter"
      inset={16}
      testID="row"
    />,
  );
  const row = screen.getByTestId('row');
  expect(StyleSheet.flatten(row.props.style)).toMatchObject({ marginHorizontal: -16 });
  expect(StyleSheet.flatten(row.props.contentContainerStyle)).toMatchObject({
    paddingHorizontal: 16,
  });
});

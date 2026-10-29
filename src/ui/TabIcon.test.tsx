import { render, screen } from '@testing-library/react-native';

import { TabIcon, type TabName } from './TabIcon';

const NAMES: TabName[] = ['home', 'events', 'post', 'chapter', 'profile'];
const hidden = { includeHiddenElements: true };

describe('TabIcon', () => {
  it.each(NAMES)('renders the %s icon in both states', async (name) => {
    await render(<TabIcon name={name} focused={false} />);
    expect(screen.getByTestId(`tab-icon-${name}`, hidden)).toBeTruthy();
    await render(<TabIcon name={name} focused />);
    expect(screen.getByTestId(`tab-icon-${name}-active`, hidden)).toBeTruthy();
  });

  it('is hidden from screen readers, since the tab label already says what it is', async () => {
    await render(<TabIcon name="home" focused />);
    expect(screen.queryByTestId('tab-icon-home-active')).toBeNull();
    expect(screen.getByTestId('tab-icon-home-active', hidden)).toBeTruthy();
  });

  it('respects a custom size', async () => {
    await render(<TabIcon name="events" focused={false} size={30} />);
    expect(screen.getByTestId('tab-icon-events', hidden).props.width).toBe(30);
  });
});

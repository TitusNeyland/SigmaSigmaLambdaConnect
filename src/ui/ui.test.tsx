import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from 'react-native';

import { palette, passesAA } from '@/theme';

import {
  AppText,
  Avatar,
  avatarTone,
  BottomSheet,
  Button,
  buttonColors,
  chipTones,
  clampPercent,
  initials,
  ListRow,
  ListSection,
  percentOf,
  ProgressBar,
  ProgressRing,
  ringDash,
  SegmentedControl,
  StatusChip,
  SwitchRow,
} from './index';

describe('AppText', () => {
  it('renders with the type scale and a custom color', async () => {
    await render(
      <AppText variant="largeTitle" color={palette.goldText}>
        Events
      </AppText>,
    );
    expect(screen.getByText('Events')).toHaveStyle({
      fontSize: 34,
      fontWeight: '700',
      color: palette.goldText,
    });
  });

  it('defaults to body text in ink', async () => {
    await render(<AppText>Hello</AppText>);
    expect(screen.getByText('Hello')).toHaveStyle({ fontSize: 16, color: palette.ink });
  });
});

describe('Button', () => {
  it('calls onPress and is announced as a button', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner and blocks presses while loading', async () => {
    const onPress = jest.fn();
    await render(<Button title="Posting" onPress={onPress} loading testID="post" />);
    expect(screen.getByTestId('post-spinner')).toBeTruthy();
    expect(screen.getByRole('button')).toBeBusy();
    expect(screen.getByRole('button')).toBeDisabled();
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses a custom accessibility label when given', async () => {
    await render(<Button title="RSVP" accessibilityLabel="RSVP to Service Day" />);
    expect(screen.getByRole('button', { name: 'RSVP to Service Day' })).toBeTruthy();
  });

  it.each(Object.entries(buttonColors).filter(([v]) => v !== 'plain'))(
    'the %s variant has readable text',
    (_variant, { bg, fg }) => {
      expect(passesAA(fg, bg)).toBe(true);
    },
  );

  it('the plain variant uses goldText, which is readable on white', async () => {
    expect(passesAA(buttonColors.plain.fg, palette.bg)).toBe(true);
  });
});

describe('ListSection and ListRow', () => {
  it('renders an uppercase header, rows and a footer', async () => {
    await render(
      <ListSection header="Account" footer="Only you can see this.">
        <ListRow title="Email" value="sample@example.com" />
        <ListRow title="Password" onPress={() => {}} />
      </ListSection>,
    );
    expect(screen.getByRole('header', { name: 'ACCOUNT' })).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('sample@example.com')).toBeTruthy();
    expect(screen.getByText('Only you can see this.')).toBeTruthy();
  });

  it('tappable rows are buttons with a combined label', async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Blocked accounts" value="1" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Blocked accounts, 1' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('rows without onPress are not buttons', async () => {
    await render(<ListRow title="Membership" value="Approved" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Membership, Approved')).toBeTruthy();
  });

  it('destructive rows use the destructive color', async () => {
    await render(<ListRow title="Delete account" destructive onPress={() => {}} />);
    expect(screen.getByText('Delete account')).toHaveStyle({ color: palette.destructive });
  });

  it('renders leading and trailing content', async () => {
    await render(<ListRow title="Leadership" leading={<Text>L</Text>} trailing={<Text>7</Text>} />);
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });
});

describe('SwitchRow', () => {
  it('reports the new value when toggled', async () => {
    const onValueChange = jest.fn();
    await render(
      <SwitchRow
        title="Event reminders"
        value={false}
        onValueChange={onValueChange}
        testID="reminders"
      />,
    );
    await fireEvent(screen.getByTestId('reminders'), 'valueChange', true);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('labels the switch with the row title', async () => {
    await render(<SwitchRow title="Show phone" value onValueChange={() => {}} />);
    expect(screen.getByLabelText('Show phone')).toBeTruthy();
  });
});

describe('SegmentedControl', () => {
  const segments = [
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'calendar', label: 'Calendar' },
  ] as const;

  it('marks the selected segment and reports changes', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        segments={segments}
        value="upcoming"
        onChange={onChange}
        accessibilityLabel="View"
      />,
    );
    expect(screen.getByRole('tab', { name: 'Upcoming' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Calendar' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Calendar' }));
    expect(onChange).toHaveBeenCalledWith('calendar');
  });

  it('does not report a change when the selected segment is tapped again', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        segments={segments}
        value="upcoming"
        onChange={onChange}
        accessibilityLabel="View"
      />,
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Upcoming' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('BottomSheet', () => {
  const wrap = (ui: React.ReactElement) => (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {ui}
    </SafeAreaProvider>
  );

  it('shows its title and content when visible', async () => {
    await render(
      wrap(
        <BottomSheet visible onClose={() => {}} title="Block Jordan?">
          <Text>{"You won't see his posts."}</Text>
        </BottomSheet>,
      ),
    );
    expect(screen.getByRole('header', { name: 'Block Jordan?' })).toBeTruthy();
    expect(screen.getByText("You won't see his posts.")).toBeTruthy();
  });

  it('closes when the backdrop is tapped', async () => {
    const onClose = jest.fn();
    await render(
      wrap(
        <BottomSheet visible onClose={onClose} testID="sheet">
          <Text>Body</Text>
        </BottomSheet>,
      ),
    );
    await fireEvent.press(screen.getByTestId('sheet-backdrop', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when hidden', async () => {
    await render(
      wrap(
        <BottomSheet visible={false} onClose={() => {}}>
          <Text>Hidden body</Text>
        </BottomSheet>,
      ),
    );
    expect(screen.queryByText('Hidden body')).toBeNull();
  });
});

describe('Avatar', () => {
  it.each([
    ['Marcus Reed', 'MR'],
    ['  jordan   ellis  ', 'JE'],
    ['Andre', 'A'],
    ['Darius Lamar King', 'DK'],
    ['', '?'],
  ])('initials(%p) is %p', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('shows initials when there is no photo, labeled with the name', async () => {
    await render(<Avatar name="Marcus Reed" />);
    expect(screen.getByText('MR')).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Marcus Reed' })).toBeTruthy();
  });

  it('shows the photo instead of initials when there is one', async () => {
    await render(<Avatar name="Marcus Reed" uri="https://example.com/a.jpg" />);
    expect(screen.queryByText('MR')).toBeNull();
  });

  it('gives the same person the same tone, with readable initials', async () => {
    expect(avatarTone('Marcus Reed')).toEqual(avatarTone('Marcus Reed'));
    for (const name of [
      'Marcus Reed',
      'Jordan Ellis',
      'Andre Hollis',
      'Kevin Walker',
      'A',
      'Zed',
    ]) {
      const { bg, fg } = avatarTone(name);
      expect(passesAA(fg, bg, true)).toBe(true);
    }
  });
});

describe('progress math', () => {
  it.each([
    [-5, 0],
    [0, 0],
    [42.4, 42],
    [42.6, 43],
    [100, 100],
    [140, 100],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('clampPercent(%p) is %p', (input, expected) => {
    expect(clampPercent(input)).toBe(expected);
  });

  it('percentOf handles zero totals and rounds', async () => {
    expect(percentOf(3, 4)).toBe(75);
    expect(percentOf(19, 25)).toBe(76);
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(6, 4)).toBe(100);
  });

  it('ringDash fills the right share of the circumference', async () => {
    const [filled, total] = ringDash(76, 36);
    expect(total).toBeCloseTo(2 * Math.PI * 36, 5);
    expect(filled).toBeCloseTo(total * 0.76, 5);
    expect(ringDash(0, 36)[0]).toBe(0);
    expect(ringDash(150, 36)[0]).toBeCloseTo(total, 5);
  });
});

describe('ProgressRing and ProgressBar', () => {
  it('the ring exposes its value to screen readers', async () => {
    await render(<ProgressRing percent={76} accessibilityLabel="Annual goals, 76 percent" />);
    const ring = screen.getByRole('progressbar', { name: 'Annual goals, 76 percent' });
    expect(ring).toHaveAccessibilityValue({ min: 0, max: 100, now: 76 });
  });

  it('the ring clamps out of range values', async () => {
    await render(<ProgressRing percent={130} />);
    expect(screen.getByRole('progressbar', { name: '100 percent' })).toHaveAccessibilityValue({
      now: 100,
    });
  });

  it('the bar fills to the percent', async () => {
    await render(<ProgressBar percent={68} testID="part" />);
    expect(screen.getByTestId('part-fill')).toHaveStyle({ width: '68%' });
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ now: 68 });
  });
});

describe('StatusChip', () => {
  it('renders its label', async () => {
    await render(<StatusChip label="At risk" tone="warning" />);
    expect(screen.getByText('At risk')).toHaveStyle({ color: palette.warning });
  });

  it.each(Object.entries(chipTones))('the %s tone is readable', (_tone, { bg, fg }) => {
    expect(passesAA(fg, bg)).toBe(true);
  });
});

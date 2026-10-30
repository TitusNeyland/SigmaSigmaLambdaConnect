import { act, render, screen } from '@testing-library/react-native';

import { notifyReported } from './feedEvents';
import { NOTICE_MS, ReportedNotice } from './ReportedNotice';

it('thanks the member after a report, then goes away on its own', async () => {
  jest.useFakeTimers();
  await render(<ReportedNotice />);
  expect(screen.queryByTestId('reported-notice')).toBeNull();
  await act(async () => notifyReported('comment'));
  expect(screen.getByTestId('reported-notice')).toHaveTextContent(/won’t see this comment/);
  await act(async () => jest.advanceTimersByTime(NOTICE_MS));
  expect(screen.queryByTestId('reported-notice')).toBeNull();
  jest.useRealTimers();
});

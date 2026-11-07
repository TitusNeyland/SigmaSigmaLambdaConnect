import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { AvatarZoomProvider, zoomFrame, ZoomableAvatar, ZOOM_HOLD_MS } from './AvatarZoom';

const SCREEN = { width: 400, height: 800 };

describe('zoomFrame', () => {
  it('centers a circle 80% of the screen width', () => {
    const f = zoomFrame({ x: 16, y: 100, size: 86 }, SCREEN);
    expect(f.size).toBe(320);
    expect(f.left).toBe(40);
    expect(f.top).toBe(240);
  });

  it('starts exactly over the avatar it came from', () => {
    const from = { x: 16, y: 100, size: 86 };
    const f = zoomFrame(from, SCREEN);
    // At the start the big circle is shrunk by `scale` and moved by (dx, dy) around its center.
    const center = { x: f.left + f.size / 2 + f.dx, y: f.top + f.size / 2 + f.dy };
    expect(center).toEqual({ x: from.x + from.size / 2, y: from.y + from.size / 2 });
    expect(f.size * f.scale).toBeCloseTo(from.size);
  });

  it('uses the shorter side in landscape', () => {
    expect(zoomFrame({ x: 0, y: 0, size: 40 }, { width: 800, height: 400 }).size).toBe(320);
  });
});

describe('ZoomableAvatar', () => {
  // Native measuring doesn't run in tests (the jest View is a mock); report a fixed spot.
  type Measured = (x: number, y: number, width: number, height: number) => void;
  beforeEach(() => {
    const view = View.prototype as unknown as { measureInWindow: (cb: Measured) => void };
    jest.spyOn(view, 'measureInWindow').mockImplementation((cb) => cb(16, 100, 86, 86));
  });
  afterEach(() => jest.restoreAllMocks());

  async function renderAvatar(uri: string | null) {
    await render(
      <AvatarZoomProvider>
        <ZoomableAvatar name="Test Brother" uri={uri} size={86} testID="avatar" />
      </AvatarZoomProvider>,
    );
  }

  it('zooms the photo while held and puts it back on release', async () => {
    jest.useFakeTimers();
    await renderAvatar('https://example.com/a.jpg');
    const avatar = screen.getByTestId('avatar-zoom');
    expect(screen.queryByTestId('avatar-zoom-photo')).toBeNull();

    await fireEvent(avatar, 'pressIn');
    await fireEvent(avatar, 'longPress');
    expect(screen.getByTestId('avatar-zoom-photo').props.source).toEqual({
      uri: 'https://example.com/a.jpg',
    });
    // The photo leaves its spot, so it reads as the same circle lifting.
    expect(avatar).toHaveStyle({ opacity: 0 });

    await fireEvent(avatar, 'pressOut');
    await act(async () => {
      jest.advanceTimersByTime(ZOOM_HOLD_MS + 1000);
    });
    expect(screen.queryByTestId('avatar-zoom-photo')).toBeNull();
    expect(avatar).not.toHaveStyle({ opacity: 0 });
    jest.useRealTimers();
  });

  it('does nothing on a quick tap', async () => {
    await renderAvatar('https://example.com/a.jpg');
    const avatar = screen.getByTestId('avatar-zoom');
    await fireEvent(avatar, 'pressIn');
    await fireEvent(avatar, 'pressOut');
    expect(screen.queryByTestId('avatar-zoom-photo')).toBeNull();
  });

  it('does not zoom initials', async () => {
    await renderAvatar(null);
    expect(screen.queryByTestId('avatar-zoom')).toBeNull();
    expect(screen.getByTestId('avatar')).toBeTruthy();
  });
});

import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { MAX_PINCH, PhotoZoomProvider, pinchOffset, pinchScale, ZoomablePhoto } from './PhotoZoom';

// Native measuring doesn't run in tests; the photo sits 100pt down a 400pt-wide screen.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    measure: () => ({ x: 0, y: 0, width: 400, height: 400, pageX: 0, pageY: 100 }),
  };
});

const SIZE = { width: 400, height: 400 };

describe('pinchScale', () => {
  it('never shrinks a photo below its size in the post', () => {
    expect(pinchScale(0.5)).toBe(1);
  });

  it('stops at the most zoom', () => {
    expect(pinchScale(10)).toBe(MAX_PINCH);
    expect(pinchScale(2)).toBe(2);
  });
});

describe('pinchOffset', () => {
  it("doesn't move before the pinch grows", () => {
    expect(pinchOffset({ x: 120, y: 80 }, { x: 120, y: 80 }, SIZE, 1)).toEqual({ x: 0, y: 0 });
  });

  it('keeps the pinched spot under the fingers', () => {
    const start = { x: 100, y: 300 };
    const focal = { x: 150, y: 250 };
    const scale = 2.5;
    const o = pinchOffset(start, focal, SIZE, scale);
    // Where the first-pinched spot ends up once moved by o and scaled about the center.
    const c = { x: SIZE.width / 2, y: SIZE.height / 2 };
    expect(c.x + o.x + scale * (start.x - c.x)).toBeCloseTo(focal.x);
    expect(c.y + o.y + scale * (start.y - c.y)).toBeCloseTo(focal.y);
  });

  it('zooms about the center without moving it', () => {
    expect(pinchOffset({ x: 200, y: 200 }, { x: 200, y: 200 }, SIZE, 3)).toEqual({ x: 0, y: 0 });
  });
});

describe('ZoomablePhoto', () => {
  async function renderPhoto(uri: string | null) {
    await render(
      <GestureHandlerRootView>
        <PhotoZoomProvider>
          <ZoomablePhoto uri={uri} style={SIZE} testID="photo">
            <Text>photo</Text>
          </ZoomablePhoto>
        </PhotoZoomProvider>
      </GestureHandlerRootView>,
    );
  }

  it('lifts the photo above the screen while pinched and settles it back after', async () => {
    await renderPhoto('https://example.com/p.jpg');
    expect(screen.queryByTestId('photo-zoom')).toBeNull();

    await act(async () => {
      fireGestureHandler(getByGestureTestId('photo-pinch'), [
        { state: State.BEGAN },
        { state: State.ACTIVE, scale: 1, focalX: 200, focalY: 200 },
        { state: State.ACTIVE, scale: 2, focalX: 220, focalY: 210 },
      ]);
    });
    expect(screen.getByTestId('photo-zoom-photo').props.source).toEqual([
      { uri: 'https://example.com/p.jpg' },
    ]);

    await act(async () => {
      fireGestureHandler(getByGestureTestId('photo-pinch'), [{ state: State.END, scale: 2 }]);
    });
    await waitFor(() => expect(screen.queryByTestId('photo-zoom')).toBeNull());
  });

  it("can't be pinched before the photo loads", async () => {
    await renderPhoto(null);
    expect(screen.getByTestId('photo')).toBeTruthy();
    expect(() => getByGestureTestId('photo-pinch')).toThrow();
  });
});

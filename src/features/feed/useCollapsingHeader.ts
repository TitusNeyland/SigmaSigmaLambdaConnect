import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** How long the header takes to settle fully in or out after a scroll stops. */
export const HEADER_SNAP_MS = 180;

/**
 * How much of the header is scrolled away, from 0 (shown) to `height` (gone). It follows the
 * scroll: going down hides it as fast as the feed moves, going up brings it straight back,
 * like Instagram. At the top of the feed it is always shown.
 */
export function nextHidden(hidden: number, prevY: number, y: number, height: number): number {
  'worklet';
  if (y <= 0) return 0;
  return Math.min(height, Math.max(0, hidden + (y - prevY)));
}

/** Where a half-hidden header settles when the scroll stops: whichever way is closer. */
export function snapHidden(hidden: number, y: number, height: number): number {
  'worklet';
  if (y <= 0 || hidden < height / 2) return 0;
  return height;
}

/**
 * A header that scrolls away as the member scrolls down a list and comes back as they
 * scroll up.
 *
 * The header and the list sit together in one view (`slideStyle`) that slides up by however
 * much of the header is hidden. That view is one header taller than the screen
 * (`marginBottom: -height`), so the list still reaches the bottom. Only transforms and
 * opacity animate, never layout, so it stays smooth and in step with the scroll.
 */
export function useCollapsingHeader() {
  const [height, setHeight] = useState(0);
  const measured = useSharedValue(0);
  const hidden = useSharedValue(0);
  const lastY = useSharedValue(0);

  const settle = () => {
    'worklet';
    const target = snapHidden(hidden.get(), lastY.get(), measured.get());
    if (target !== hidden.get()) hidden.set(withTiming(target, { duration: HEADER_SNAP_MS }));
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      // Ignore the bounce past either end, so it never flickers the header.
      const max = Math.max(0, e.contentSize.height - e.layoutMeasurement.height);
      const y = Math.min(Math.max(e.contentOffset.y, 0), max);
      hidden.set(nextHidden(hidden.get(), lastY.get(), y, measured.get()));
      lastY.set(y);
    },
    onEndDrag: settle,
    onMomentumEnd: settle,
  });

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -hidden.get() }],
  }));
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: measured.get() > 0 ? 1 - hidden.get() / measured.get() : 1,
  }));

  const onHeaderLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    measured.set(h);
    setHeight(h);
  };

  return { onScroll, slideStyle, fadeStyle, onHeaderLayout, height };
}

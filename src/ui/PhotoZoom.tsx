import { Image } from 'expo-image';
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, usePinchGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, motion } from '@/theme';

/** How far a photo can be pinched in. */
export const MAX_PINCH = 4;

type Point = { x: number; y: number };
type Frame = { x: number; y: number; width: number; height: number };

/** How much a pinch scales the photo: never smaller than it sits in the post. */
export function pinchScale(scale: number): number {
  'worklet';
  return Math.min(MAX_PINCH, Math.max(1, scale));
}

/**
 * How far to move a photo scaled by `scale` about its center so the spot first pinched
 * (`start`) stays under the fingers (`focal`). Both points are relative to the photo's
 * top-left corner where it sits in the post.
 */
export function pinchOffset(
  start: Point,
  focal: Point,
  size: { width: number; height: number },
  scale: number,
): Point {
  'worklet';
  const cx = size.width / 2;
  const cy = size.height / 2;
  return {
    x: focal.x - cx - scale * (start.x - cx),
    y: focal.y - cy - scale * (start.y - cy),
  };
}

type PhotoZoomApi = {
  /** Where the pinched photo sits in the window, kept up to date as the list moves. */
  frame: SharedValue<Frame>;
  scale: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** Which photo is pinched, so only that one hides from its spot. */
  owner: SharedValue<string>;
  /** 1 once the zoomed copy is on screen. */
  shown: SharedValue<number>;
  show: (uri: string) => void;
  hide: (owner: string) => void;
};

const PhotoZoomContext = createContext<PhotoZoomApi | null>(null);

/**
 * Draws a pinched post photo above every screen, like Instagram. Wrap the app in it once.
 * The overlay never takes touches, so the pinch stays on the photo it started on.
 */
export function PhotoZoomProvider({ children }: { children: ReactNode }) {
  const [uri, setUri] = useState<string | null>(null);
  const host = useRef<ComponentRef<typeof View>>(null);
  // Where this view sits in the window, so window coordinates map onto the overlay.
  const offset = useSharedValue<Point>({ x: 0, y: 0 });
  const frame = useSharedValue<Frame>({ x: 0, y: 0, width: 0, height: 0 });
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const owner = useSharedValue('');
  const shown = useSharedValue(0);

  const show = useCallback((next: string) => setUri(next), []);
  const hide = useCallback(
    (who: string) => {
      // A newer pinch on another photo has taken over; leave it be.
      if (owner.get() !== who) return;
      owner.set('');
      shown.set(0);
      setUri(null);
    },
    [owner, shown],
  );

  const api = useMemo<PhotoZoomApi>(
    () => ({ frame, scale, x, y, owner, shown, show, hide }),
    [frame, scale, x, y, owner, shown, show, hide],
  );

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scale.get(), [1, 2], [0, 1], Extrapolation.CLAMP),
  }));
  const photoStyle = useAnimatedStyle(() => {
    const f = frame.get();
    const o = offset.get();
    return {
      left: f.x - o.x,
      top: f.y - o.y,
      width: f.width,
      height: f.height,
      transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
    };
  });

  return (
    <View
      ref={host}
      style={styles.flex}
      collapsable={false}
      onLayout={() => host.current?.measureInWindow((left, top) => offset.set({ x: left, y: top }))}
    >
      <PhotoZoomContext.Provider value={api}>{children}</PhotoZoomContext.Provider>
      {uri ? (
        <View style={styles.overlay} testID="photo-zoom">
          <Animated.View style={[styles.overlay, styles.scrim, scrimStyle]} />
          <Animated.View style={[styles.photo, photoStyle]}>
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              // Hide the photo in the post only once this copy covers it, so it never blinks.
              onDisplay={() => shown.set(1)}
              testID="photo-zoom-photo"
            />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

type ZoomablePhotoProps = {
  /** The photo's loaded URL, or null while it loads (it can't be pinched yet). */
  uri: string | null;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
};

/**
 * A post photo you can pinch to look closer. It lifts above the screen and follows the
 * fingers, and settles back into the post when they let go.
 */
export function ZoomablePhoto(props: ZoomablePhotoProps) {
  const zoom = useContext(PhotoZoomContext);
  if (!zoom || !props.uri) {
    return (
      <View style={props.style} testID={props.testID}>
        {props.children}
      </View>
    );
  }
  return <Pinchable {...props} uri={props.uri} zoom={zoom} />;
}

function Pinchable({
  uri,
  style,
  children,
  testID,
  zoom,
}: ZoomablePhotoProps & { uri: string; zoom: PhotoZoomApi }) {
  const id = useId();
  const ref = useAnimatedRef<Animated.View>();
  const start = useSharedValue<Point>({ x: 0, y: 0 });
  const { frame, scale, x, y, owner, shown, show, hide } = zoom;

  const place = () => {
    'worklet';
    // Follows the photo if the list under it moves, so it settles back where it now is.
    const m = measure(ref);
    if (m) frame.set({ x: m.pageX, y: m.pageY, width: m.width, height: m.height });
  };

  const pinch = usePinchGesture({
    onActivate: (e) => {
      'worklet';
      owner.set(id);
      shown.set(0);
      start.set({ x: e.focalX, y: e.focalY });
      scale.set(1);
      x.set(0);
      y.set(0);
      place();
      scheduleOnRN(show, uri);
    },
    onUpdate: (e) => {
      'worklet';
      if (owner.get() !== id) return;
      place();
      const s = pinchScale(e.scale);
      const f = frame.get();
      const offset = pinchOffset(
        start.get(),
        { x: e.focalX, y: e.focalY },
        { width: f.width, height: f.height },
        s,
      );
      scale.set(s);
      x.set(offset.x);
      y.set(offset.y);
    },
    onFinalize: () => {
      'worklet';
      if (owner.get() !== id) return;
      const timing = { duration: motion.pinchRelease, easing: Easing.out(Easing.cubic) };
      x.set(withTiming(0, timing));
      y.set(withTiming(0, timing));
      scale.set(
        withTiming(1, timing, (done) => {
          if (done) scheduleOnRN(hide, id);
        }),
      );
    },
    testID: testID ? `${testID}-pinch` : undefined,
  });

  // The photo leaves the post while its zoomed copy is up, so it reads as one photo.
  const hidden = useAnimatedStyle(() => ({
    opacity: owner.get() === id && shown.get() === 1 ? 0 : 1,
  }));

  return (
    <GestureDetector gesture={pinch}>
      <Animated.View ref={ref} style={[style, hidden]} collapsable={false} testID={testID}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  scrim: { backgroundColor: colors.scrim },
  photo: { position: 'absolute', backgroundColor: colors.fill, overflow: 'hidden' },
});

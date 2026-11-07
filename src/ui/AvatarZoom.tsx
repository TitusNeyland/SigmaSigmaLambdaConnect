import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, motion, palette } from '@/theme';

import { Avatar, RING_INSET, type AvatarProps } from './Avatar';
import { haptics } from './haptics';

/** How long a member holds a photo before it zooms. A quick tap does nothing. */
export const ZOOM_HOLD_MS = 300;
/** The zoomed circle's width, as a share of the screen's shorter side. */
const ZOOM_SHARE = 0.8;

/** A circle on screen: its top-left corner in window coordinates, and its diameter. */
export type Circle = { x: number; y: number; size: number };

/**
 * Where the zoomed photo sits and how to place it back over the avatar it came from.
 * The big circle is drawn once at full size in the middle of the screen; at the start of
 * the zoom it is moved by (dx, dy) and shrunk by `scale` so it covers the avatar exactly.
 */
export function zoomFrame(from: Circle, screen: { width: number; height: number }) {
  const size = Math.round(Math.min(screen.width, screen.height) * ZOOM_SHARE);
  return {
    size,
    left: (screen.width - size) / 2,
    top: (screen.height - size) / 2,
    dx: from.x + from.size / 2 - screen.width / 2,
    dy: from.y + from.size / 2 - screen.height / 2,
    scale: from.size / size,
  };
}

type Zoom = { uri: string; from: Circle };

type ZoomApi = {
  open: (uri: string, from: Circle, onClosed: () => void) => void;
  close: () => void;
};

const ZoomContext = createContext<ZoomApi | null>(null);

/**
 * Draws a held profile photo above every screen. Wrap the app in it once. The overlay never
 * takes touches, so the finger stays on the avatar and lifting it closes the zoom.
 */
export function AvatarZoomProvider({ children }: { children: ReactNode }) {
  const screen = useWindowDimensions();
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const host = useRef<ComponentRef<typeof View>>(null);
  // Where this view sits in the window, so window coordinates map onto the overlay.
  const offset = useRef({ x: 0, y: 0 });
  const onClosed = useRef<(() => void) | null>(null);
  const progress = useSharedValue(0);

  const finish = useCallback(() => {
    onClosed.current?.();
    onClosed.current = null;
    setZoom(null);
  }, []);

  const api = useMemo<ZoomApi>(
    () => ({
      open(uri, from, closed) {
        onClosed.current?.();
        onClosed.current = closed;
        setZoom({
          uri,
          from: { ...from, x: from.x - offset.current.x, y: from.y - offset.current.y },
        });
        progress.set(0);
        progress.set(
          withTiming(1, { duration: motion.avatarZoom, easing: Easing.out(Easing.cubic) }),
        );
      },
      close() {
        progress.set(
          withTiming(
            0,
            { duration: motion.avatarZoom, easing: Easing.inOut(Easing.cubic) },
            (done) => {
              if (done) scheduleOnRN(finish);
            },
          ),
        );
      },
    }),
    [finish, progress],
  );

  const frame = zoom ? zoomFrame(zoom.from, screen) : null;

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const circleStyle = useAnimatedStyle(() => {
    if (!frame) return {};
    const p = progress.get();
    return {
      transform: [
        { translateX: frame.dx * (1 - p) },
        { translateY: frame.dy * (1 - p) },
        { scale: frame.scale + (1 - frame.scale) * p },
      ],
      shadowOpacity: 0.25 * p,
    };
  });

  return (
    <View
      ref={host}
      style={styles.flex}
      collapsable={false}
      onLayout={() =>
        host.current?.measureInWindow((x, y) => {
          offset.current = { x, y };
        })
      }
    >
      <ZoomContext.Provider value={api}>{children}</ZoomContext.Provider>
      {zoom && frame ? (
        <View style={styles.overlay} testID="avatar-zoom">
          <Animated.View style={[styles.overlay, styles.scrim, scrimStyle]} />
          <Animated.View
            style={[
              styles.circle,
              {
                left: frame.left,
                top: frame.top,
                width: frame.size,
                height: frame.size,
                borderRadius: frame.size / 2,
              },
              circleStyle,
            ]}
          >
            <Image
              source={{ uri: zoom.uri }}
              style={{ width: frame.size, height: frame.size, borderRadius: frame.size / 2 }}
              testID="avatar-zoom-photo"
            />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * An avatar that zooms when held, like Instagram: the circle lifts toward the screen,
 * the rest dims, and letting go puts it back. Only photos zoom, not initials.
 */
export function ZoomableAvatar(props: AvatarProps) {
  const zoom = useContext(ZoomContext);
  const avatar = useRef<ComponentRef<typeof View>>(null);
  const holding = useRef(false);
  const zoomed = useRef(false);
  const [lifted, setLifted] = useState(false);
  const { uri, ring, size = 40 } = props;

  if (!uri || !zoom) return <Avatar {...props} />;

  const inset = ring ? RING_INSET : 0;

  return (
    <Pressable
      ref={avatar}
      // The zoom is only a closer look; the avatar keeps its own label for screen readers.
      accessible={false}
      delayLongPress={ZOOM_HOLD_MS}
      onPressIn={() => {
        holding.current = true;
      }}
      onLongPress={() =>
        avatar.current?.measureInWindow((x, y) => {
          if (!holding.current) return;
          haptics.tap();
          zoomed.current = true;
          setLifted(true);
          zoom.open(uri, { x: x + inset, y: y + inset, size }, () => setLifted(false));
        })
      }
      onPressOut={() => {
        holding.current = false;
        if (!zoomed.current) return;
        zoomed.current = false;
        zoom.close();
      }}
      // The photo leaves its spot while it's zoomed, so it reads as the same circle.
      style={lifted ? styles.lifted : undefined}
      testID={props.testID ? `${props.testID}-zoom` : undefined}
    >
      <Avatar {...props} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  scrim: { backgroundColor: colors.scrim },
  circle: {
    position: 'absolute',
    backgroundColor: colors.fill,
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
  },
  lifted: { opacity: 0 },
});

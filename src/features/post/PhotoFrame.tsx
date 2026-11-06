import { Image } from 'expo-image';
import { useImperativeHandle, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors } from '@/theme';

import { clampView, panBy, shown, zoomAt, type View as PhotoView } from './cropLogic';

type Size = { width: number; height: number };

/** Reads where the photo is now, inside the edges, to save its framing. */
export type FrameHandle = { view: () => PhotoView };

/** Settles back inside the edges quickly, without a wobble. */
const SETTLE = { damping: 28, stiffness: 320, mass: 0.6 } as const;

/**
 * One photo in the post's frame: pinch to zoom around the fingers and drag to move it, both
 * at once. The gestures run on the UI thread, so the photo tracks the fingers smoothly. It
 * gives a little past the edges and zoom limits, then springs back on release. The screen
 * reads where it is through `ref` when it saves.
 */
export function PhotoFrame({
  photo,
  frame,
  start,
  ref,
}: {
  photo: Size & { uri: string };
  frame: Size;
  /** Where the photo sits when this opens. Remount (change the key) to start over. */
  start: PhotoView;
  ref?: Ref<FrameHandle>;
}) {
  const scale = useSharedValue(start.scale);
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  // Fingers' gestures in progress, so release only settles once both pinch and drag end.
  const touching = useSharedValue(0);
  const image = { width: photo.width, height: photo.height };
  const box = { width: frame.width, height: frame.height };

  useImperativeHandle(ref, () => ({
    view: () => clampView({ scale: scale.get(), x: x.get(), y: y.get() }, image, box),
  }));

  const begin = () => {
    'worklet';
    touching.set(touching.get() + 1);
  };

  const finish = () => {
    'worklet';
    touching.set(Math.max(0, touching.get() - 1));
    if (touching.get() > 0) return;
    const settled = clampView({ scale: scale.get(), x: x.get(), y: y.get() }, image, box);
    scale.set(withSpring(settled.scale, SETTLE));
    x.set(withSpring(settled.x, SETTLE));
    y.set(withSpring(settled.y, SETTLE));
  };

  const pan = usePanGesture({
    onBegin: begin,
    onUpdate: (e) => {
      'worklet';
      const next = panBy(
        { scale: scale.get(), x: x.get(), y: y.get() },
        e.changeX,
        e.changeY,
        image,
        box,
      );
      x.set(next.x);
      y.set(next.y);
    },
    onFinalize: finish,
    testID: 'editor-pan',
  });

  const pinch = usePinchGesture({
    onBegin: begin,
    onUpdate: (e) => {
      'worklet';
      const next = zoomAt(
        { scale: scale.get(), x: x.get(), y: y.get() },
        e.scaleChange,
        { x: e.focalX - box.width / 2, y: e.focalY - box.height / 2 },
        image,
        box,
      );
      scale.set(next.scale);
      x.set(next.x);
      y.set(next.y);
    },
    onFinalize: finish,
    testID: 'editor-pinch',
  });

  const gesture = useSimultaneousGestures(pan, pinch);

  // The photo at its fill size, centered; the zoom and offset are a transform on top.
  const base = shown(image, box, 1);
  const moved = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.frame, box]}
        accessibilityLabel="Photo. Pinch to zoom, drag to move."
        testID="editor-frame"
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: base.width,
              height: base.height,
              left: (box.width - base.width) / 2,
              top: (box.height - base.height) / 2,
            },
            moved,
          ]}
        >
          <Image
            source={{ uri: photo.uri }}
            contentFit="fill"
            style={StyleSheet.absoluteFill}
            testID="editor-photo"
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.fill },
});

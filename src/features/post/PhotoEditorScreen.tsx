import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, Button, HeaderButton, SegmentedControl } from '@/ui';

import {
  clampView,
  cropFromView,
  frameAspect,
  SHAPES,
  viewFromCrop,
  type Crop,
  type FrameShape,
  type View as PhotoView,
} from './cropLogic';
import { makeCover, usePostDraft } from './draft';

const THUMB = 56;
const CENTERED: PhotoView = { scale: 1, x: 0, y: 0 };

type Touches = { x: number; y: number; distance: number };

/** Where the fingers are: their midpoint, and how far apart two of them are. */
function touchesOf(e: GestureResponderEvent): Touches {
  const t = e.nativeEvent.touches;
  if (t.length < 2) return { x: t[0]?.pageX ?? 0, y: t[0]?.pageY ?? 0, distance: 0 };
  const [a, b] = [t[0], t[1]];
  return {
    x: (a.pageX + b.pageX) / 2,
    y: (a.pageY + b.pageY) / 2,
    distance: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY),
  };
}

/**
 * Frame the post's photos, Instagram style: choose the post's shape, then pinch to zoom and
 * drag each photo to choose what shows. The feed shows the post at this shape, so nothing
 * the member framed gets cut off.
 */
export function PhotoEditorScreen({ start }: { start: number }) {
  const { draft, setShape, setCrops, setPhotos } = usePostDraft();
  const { width } = useWindowDimensions();
  const photos = draft.photos;
  const [index, setIndex] = useState(Math.min(Math.max(start, 0), photos.length - 1));
  const [shape, setLocalShape] = useState<FrameShape>(draft.shape);
  // Framing changed here, by uri. Saved to the draft on Done.
  const [crops, setLocalCrops] = useState<Record<string, Crop>>({});
  const photo = photos[index];
  const aspect = frameAspect(shape, photos[0]);
  const frame = { width, height: Math.round(width / aspect) };

  const savedCrop = (uri: string) =>
    crops[uri] ?? (shape === draft.shape ? photos.find((p) => p.uri === uri)?.crop : undefined);

  const viewFor = (uri: string): PhotoView => {
    const p = photos.find((q) => q.uri === uri);
    const crop = savedCrop(uri);
    return p && crop ? viewFromCrop(crop, p, frame) : CENTERED;
  };
  const [view, setView] = useState<PhotoView>(() => (photo ? viewFor(photo.uri) : CENTERED));

  // Pinch and drag, with the frame's own touch handlers: one finger moves, two zoom.
  const gesture = useRef<{ start: PhotoView; touches: Touches; count: number } | null>(null);
  // The newest position, for saving on release even before the screen has redrawn.
  const latest = useRef<PhotoView | null>(null);

  function begin(e: GestureResponderEvent) {
    gesture.current = {
      start: latest.current ?? view,
      touches: touchesOf(e),
      count: e.nativeEvent.touches.length,
    };
  }

  function move(e: GestureResponderEvent) {
    const g = gesture.current;
    if (!g || !photo) return;
    const now = touchesOf(e);
    // A finger added or lifted: carry on from here, so the photo doesn't jump.
    if (e.nativeEvent.touches.length !== g.count) return begin(e);
    const zoom = g.touches.distance > 0 && now.distance > 0 ? now.distance / g.touches.distance : 1;
    const next = clampView(
      {
        scale: g.start.scale * zoom,
        x: g.start.x + (now.x - g.touches.x),
        y: g.start.y + (now.y - g.touches.y),
      },
      photo,
      frame,
    );
    latest.current = next;
    setView(next);
  }

  function end() {
    const last = latest.current ?? view;
    gesture.current = null;
    latest.current = null;
    if (photo) setLocalCrops((c) => ({ ...c, [photo.uri]: cropFromView(last, photo, frame) }));
  }

  if (!photo) return null;

  function open(i: number) {
    const next = photos[i];
    if (!next) return;
    setIndex(i);
    setView(viewFor(next.uri));
  }

  function changeShape(next: FrameShape) {
    // A new frame starts every photo centered again.
    setLocalShape(next);
    setLocalCrops({});
    setView(CENTERED);
  }

  function cover() {
    setPhotos((all) => makeCover(all, photo.uri));
    setIndex(0);
    // With Original, the cover sets the frame, so framing starts over.
    if (shape === 'original') {
      setLocalCrops({});
      setView(CENTERED);
    }
  }

  function done() {
    setShape(shape);
    setCrops(crops);
    router.back();
  }

  const fill = Math.max(frame.width / photo.width, frame.height / photo.height) * view.scale;
  const shown = { width: photo.width * fill, height: photo.height * fill };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HeaderButton title="Cancel" onPress={() => router.back()} testID="editor-cancel" />
        <AppText variant="headline" accessibilityRole="header">
          Edit photos
        </AppText>
        <HeaderButton title="Done" bold onPress={done} testID="editor-done" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.inset}>
          <SegmentedControl
            segments={SHAPES}
            value={shape}
            onChange={changeShape}
            accessibilityLabel="Post shape"
            testID="editor-shape"
          />
        </View>

        <View
          style={[styles.frame, frame]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          // Keep the photo while dragging, even if the page would like to scroll.
          onResponderTerminationRequest={() => false}
          onResponderGrant={begin}
          onResponderMove={move}
          onResponderRelease={end}
          onResponderTerminate={end}
          accessibilityLabel="Photo. Pinch to zoom, drag to move."
          testID="editor-frame"
        >
          <Image
            source={{ uri: photo.uri }}
            contentFit="fill"
            style={{
              position: 'absolute',
              width: shown.width,
              height: shown.height,
              left: (frame.width - shown.width) / 2 + view.x,
              top: (frame.height - shown.height) / 2 + view.y,
            }}
            testID="editor-photo"
          />
        </View>

        <AppText variant="footnote" color={colors.textSecondary} style={styles.inset}>
          Pinch to zoom and drag to choose what shows. The feed shows the post at this shape.
        </AppText>

        {photos.length > 1 ? (
          <ScrollView horizontal contentContainerStyle={styles.thumbs}>
            {photos.map((p, i) => (
              <Pressable
                key={p.uri}
                onPress={() => open(i)}
                accessibilityRole="button"
                accessibilityLabel={`Edit photo ${i + 1}`}
                accessibilityState={{ selected: i === index }}
                style={[styles.thumb, i === index && styles.thumbOn]}
                testID={`editor-thumb-${i + 1}`}
              >
                <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.inset}>
          {index === 0 ? (
            <AppText variant="footnote" color={colors.textSecondary} testID="editor-is-cover">
              This is the cover. It shows first in the feed.
            </AppText>
          ) : (
            <Button
              title="Make cover"
              variant="secondary"
              onPress={cover}
              testID="editor-make-cover"
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
  },
  content: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  inset: { paddingHorizontal: spacing.lg },
  frame: { overflow: 'hidden', backgroundColor: colors.fill },
  thumbs: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.fill,
  },
  thumbOn: { borderWidth: 2, borderColor: palette.ink },
});

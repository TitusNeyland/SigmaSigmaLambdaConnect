import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, Button, HeaderButton, SegmentedControl } from '@/ui';

import {
  cropFromView,
  frameAspect,
  SHAPES,
  viewFromCrop,
  type Crop,
  type FrameShape,
  type View as PhotoView,
} from './cropLogic';
import { makeCover, usePostDraft } from './draft';
import { PhotoFrame, type FrameHandle } from './PhotoFrame';
import { useHoldSheet } from './useHoldSheet';

const THUMB = 56;
const CENTERED: PhotoView = { scale: 1, x: 0, y: 0 };

/**
 * The second step of a photo post, Instagram style: choose the post's shape, then pinch to
 * zoom and drag each photo to choose what shows. The feed shows the post at this shape, so
 * nothing the member framed gets cut off. Next goes on to the caption; Back returns to the
 * photos. Both keep the framing.
 */
export function PhotoEditorScreen({ start }: { start: number }) {
  const { draft, setShape, setCrops, setPhotos } = usePostDraft();
  useHoldSheet();
  const { width } = useWindowDimensions();
  const photos = draft.photos;
  const [index, setIndex] = useState(Math.min(Math.max(start, 0), photos.length - 1));
  const [shape, setLocalShape] = useState<FrameShape>(draft.shape);
  // Framing changed here, by uri. Saved to the draft on Back or Next.
  const [crops, setLocalCrops] = useState<Record<string, Crop>>({});
  // Bumped when framing starts over, so the photo goes back to center.
  const [restarts, setRestarts] = useState(0);
  // The photo on screen, to read where the member left it.
  const placed = useRef<FrameHandle>(null);
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
  if (!photo) return null;

  /** The framing so far, with where the photo on screen is now. */
  const latestCrops = () => {
    const view = placed.current?.view();
    return view ? { ...crops, [photo.uri]: cropFromView(view, photo, frame) } : crops;
  };

  function open(i: number) {
    const next = photos[i];
    if (!next) return;
    setLocalCrops(latestCrops());
    setIndex(i);
  }

  function changeShape(next: FrameShape) {
    // A new frame starts every photo centered again.
    setLocalShape(next);
    setLocalCrops({});
    setRestarts((n) => n + 1);
  }

  function cover() {
    setPhotos((all) => makeCover(all, photo.uri));
    setIndex(0);
    // With Original, the cover sets the frame, so framing starts over.
    if (shape === 'original') {
      setLocalCrops({});
      setRestarts((n) => n + 1);
    } else {
      setLocalCrops(latestCrops());
    }
  }

  function save() {
    const all = latestCrops();
    setLocalCrops(all);
    setShape(shape);
    setCrops(all);
  }

  function back() {
    save();
    if (router.canGoBack()) router.back();
    else router.replace('/new-post');
  }

  function next() {
    save();
    router.push('/new-post/details');
  }

  return (
    // Its own root, since the posting sheet is shown outside the app's main view on iOS.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <HeaderButton title="Back" onPress={back} testID="editor-back" />
          <AppText variant="headline" accessibilityRole="header">
            Edit photos
          </AppText>
          <HeaderButton title="Next" bold onPress={next} testID="editor-next" />
        </View>

        <View style={styles.top}>
          <View style={styles.inset}>
            <SegmentedControl
              segments={SHAPES}
              value={shape}
              onChange={changeShape}
              accessibilityLabel="Post shape"
              testID="editor-shape"
            />
          </View>

          <PhotoFrame
            key={`${photo.uri}:${frame.width}x${frame.height}:${restarts}`}
            photo={photo}
            frame={frame}
            start={viewFor(photo.uri)}
            ref={placed}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
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
                  <Image
                    source={{ uri: p.uri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
  },
  top: { gap: spacing.lg },
  content: { gap: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  inset: { paddingHorizontal: spacing.lg },
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

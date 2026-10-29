import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, Button, HeaderButton } from '@/ui';

import { addPhotos, MAX_PHOTOS, removePhoto, usePostDraft, type DraftPhoto } from './draft';
import { pickFromLibrary, takePhoto, type PhotoPick } from './pickPhotos';

const COLUMNS = 4;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

function RemoveIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path d="M6 6l12 12M18 6 6 18" stroke={palette.onInk} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

function Thumb({
  photo,
  number,
  selected,
  size,
  onSelect,
  onRemove,
}: {
  photo: DraftPhoto;
  number: number;
  selected: boolean;
  size: number;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={{ width: size, height: size }}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityLabel={`Photo ${number}`}
        accessibilityState={{ selected }}
        style={[styles.thumb, selected && styles.thumbSelected]}
        testID={`thumb-${number}`}
      >
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.badge}>
          <AppText variant="caption" weight="700">
            {String(number)}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove photo ${number}`}
        hitSlop={spacing.sm}
        style={styles.remove}
        testID={`remove-${number}`}
      >
        <RemoveIcon />
      </Pressable>
    </View>
  );
}

/** Step 1 of posting: choose up to 10 photos, take one, or write without photos. */
export function PickPhotosScreen() {
  const { draft, setPhotos, setTextOnly, reset } = usePostDraft();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const photos = draft.photos;
  const remaining = MAX_PHOTOS - photos.length;
  const preview = photos.find((p) => p.uri === selected) ?? photos[0] ?? null;
  const thumbSize = (width - spacing.lg * 2 - spacing.xs * (COLUMNS - 1)) / COLUMNS;

  function apply(pick: PhotoPick | null) {
    if (!pick) setNote('Couldn’t open your photos. Try again.');
    else if (pick.status === 'denied') {
      setNote('Allow camera access in Settings to take a photo.');
    } else if (pick.status === 'picked') {
      setNote(null);
      setPhotos((current) => addPhotos(current, pick.photos));
      setSelected(pick.photos[0]?.uri ?? null);
    }
  }

  const choose = async () => apply(await pickFromLibrary(remaining).catch(() => null));
  const camera = async () => apply(await takePhoto().catch(() => null));

  function cancel() {
    reset();
    close();
  }

  function writeOnly() {
    setPhotos(() => []);
    setTextOnly(true);
    router.push('/new-post/compose');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HeaderButton title="Cancel" onPress={cancel} testID="post-cancel" />
        <AppText variant="headline" accessibilityRole="header">
          New post
        </AppText>
        <HeaderButton
          title="Next"
          bold
          disabled={photos.length === 0}
          onPress={() => router.push('/new-post/compose')}
          testID="post-next"
        />
      </View>

      {photos.length === 0 ? (
        <View style={styles.empty}>
          <AppText variant="title3" align="center">
            Share a moment with the chapter
          </AppText>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Pick up to {MAX_PHOTOS} photos. Only approved brothers see posts.
          </AppText>
          <View style={styles.choices}>
            <Button title="Choose photos" onPress={choose} fullWidth testID="post-choose" />
            <Button
              title="Take a photo"
              variant="secondary"
              onPress={camera}
              fullWidth
              testID="post-camera"
            />
            <Button
              title="Write without photos"
              variant="plain"
              onPress={writeOnly}
              fullWidth
              testID="post-text-only"
            />
          </View>
          {note ? (
            <AppText variant="footnote" color={colors.textSecondary} align="center">
              {note}
            </AppText>
          ) : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {preview ? (
            <Image
              source={{ uri: preview.uri }}
              style={[styles.preview, { width, height: width }]}
              contentFit="cover"
              accessibilityLabel="Preview"
              testID="post-preview"
            />
          ) : null}
          <View style={styles.toolbar}>
            <AppText variant="subhead" color={colors.textSecondary} testID="post-count">
              {photos.length} of {MAX_PHOTOS}
            </AppText>
            <View style={styles.toolbarButtons}>
              <Button
                title="Camera"
                variant="secondary"
                size="small"
                onPress={camera}
                disabled={remaining === 0}
                testID="post-camera"
              />
              <Button
                title="Add more"
                variant="secondary"
                size="small"
                onPress={choose}
                disabled={remaining === 0}
                testID="post-add-more"
              />
            </View>
          </View>
          {note ? (
            <AppText variant="footnote" color={colors.textSecondary} style={styles.inset}>
              {note}
            </AppText>
          ) : null}
          <View style={styles.grid}>
            {photos.map((photo, i) => (
              <Thumb
                key={photo.uri}
                photo={photo}
                number={i + 1}
                size={thumbSize}
                selected={photo === preview}
                onSelect={() => setSelected(photo.uri)}
                onRemove={() => setPhotos((current) => removePhoto(current, photo.uri))}
              />
            ))}
          </View>
        </ScrollView>
      )}
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
  empty: { flex: 1, justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  choices: { gap: spacing.sm, marginTop: spacing.lg },
  content: { paddingBottom: spacing.xxxl, gap: spacing.md },
  preview: { backgroundColor: colors.fill },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  toolbarButtons: { flexDirection: 'row', gap: spacing.sm },
  inset: { paddingHorizontal: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.lg },
  thumb: { flex: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.fill },
  thumbSelected: { borderWidth: 2, borderColor: palette.ink },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    minWidth: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: palette.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

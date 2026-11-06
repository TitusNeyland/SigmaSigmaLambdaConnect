import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, HeaderButton } from '@/ui';

import { toDraftPhoto, type RollPhoto } from './cameraRoll';
import { CameraRollGrid } from './CameraRollGrid';
import { addPhotos, MAX_PHOTOS, removePhoto, usePostDraft } from './draft';
import { pickFromLibrary, takePhoto, type PhotoPick } from './pickPhotos';

function RemoveIcon() {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path d="M6 6l12 12M18 6 6 18" stroke={palette.onInk} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

/** Opens the editor at a photo, the next step of a photo post. */
const editPhoto = (i: number) =>
  router.push({ pathname: '/new-post/edit', params: { photo: String(i) } });

/**
 * The first step of a post, Instagram style: the Post tab opens here. Pick photos from the
 * camera roll or camera, then Next opens the editor. With no photos, Next goes straight to the
 * caption for a text post.
 */
export function PickScreen() {
  const { draft, setPhotos, reset } = usePostDraft();
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const photos = draft.photos;
  const remaining = MAX_PHOTOS - photos.length;

  function addPicked(pick: PhotoPick | null) {
    if (!pick) setPhotoNote('Couldn’t open your photos. Try again.');
    else if (pick.status === 'denied') {
      setPhotoNote('Allow camera access in Settings to take a photo.');
    } else if (pick.status === 'picked') {
      setPhotoNote(null);
      setPhotos((current) => addPhotos(current, pick.photos));
    }
  }

  // The system photo picker scrolls the whole camera roll without the app needing access to
  // the member's library.
  const choosePhotos = async () => addPicked(await pickFromLibrary(remaining).catch(() => null));
  const openCamera = async () => addPicked(await takePhoto().catch(() => null));

  async function pickFromRoll(photo: RollPhoto) {
    const draftPhoto = await toDraftPhoto(photo).catch(() => null);
    if (!draftPhoto) return setPhotoNote('Couldn’t add that photo. Try another.');
    setPhotoNote(null);
    setPhotos((current) => addPhotos(current, [draftPhoto]));
  }

  function cancel() {
    reset();
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }

  function next() {
    if (photos.length) editPhoto(0);
    else router.push('/new-post/details');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HeaderButton title="Cancel" onPress={cancel} testID="pick-cancel" />
        <AppText variant="headline" accessibilityRole="header">
          New post
        </AppText>
        <HeaderButton title="Next" bold onPress={next} testID="pick-next" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {photos.length > 0 ? (
          <View style={styles.field}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbs}
            >
              {photos.map((photo, i) => (
                <View key={photo.uri} style={styles.thumbWrap}>
                  <Pressable
                    onPress={() => editPhoto(i)}
                    accessibilityRole="button"
                    accessibilityLabel={i === 0 ? 'Photo 1, cover' : `Photo ${i + 1}`}
                    accessibilityHint="Opens the photo to zoom, move and set the cover"
                    style={[styles.thumb, i === 0 && styles.cover]}
                    testID={`pick-photo-${i + 1}`}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    {i === 0 ? (
                      <View style={styles.coverLabel}>
                        <AppText variant="caption" weight="700" color={palette.onInk}>
                          Cover
                        </AppText>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => setPhotos((all) => removePhoto(all, photo.uri))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${i + 1}`}
                    hitSlop={spacing.md}
                    style={styles.remove}
                    testID={`pick-remove-${i + 1}`}
                  >
                    <RemoveIcon />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <AppText variant="footnote" color={colors.textSecondary}>
            Pick up to {MAX_PHOTOS} photos, or tap Next to write a text post.
          </AppText>
        )}
        {photoNote ? (
          <AppText variant="footnote" color={colors.textSecondary} testID="pick-photo-note">
            {photoNote}
          </AppText>
        ) : null}
        <CameraRollGrid
          picked={photos}
          remaining={remaining}
          onPick={(photo) => void pickFromRoll(photo)}
          onUnpick={(assetId) => setPhotos((all) => all.filter((p) => p.assetId !== assetId))}
          onCamera={() => void openCamera()}
          onLibrary={() => void choosePhotos()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const THUMB = MIN_TOUCH * 2;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
    backgroundColor: colors.background,
  },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  field: { gap: spacing.sm },
  thumbs: { gap: spacing.sm },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.fill,
  },
  cover: { borderWidth: 2, borderColor: palette.ink },
  coverLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: spacing.xxs,
    alignItems: 'center',
    backgroundColor: palette.scrim,
  },
  thumbWrap: { width: THUMB, height: THUMB },
  remove: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: palette.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

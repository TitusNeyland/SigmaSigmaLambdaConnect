import { Image } from 'expo-image';
import { presentPermissionsPicker, usePermissions } from 'expo-media-library';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, palette, radius, spacing } from '@/theme';
import { AppText, BottomSheet, Button, ListRow, ListSection } from '@/ui';

import {
  listAlbums,
  loadPhotos,
  RECENTS,
  ROLL_PAGE,
  sourceTitle,
  type RollAlbum,
  type RollPhoto,
  type RollSource,
} from './cameraRoll';
import type { DraftPhoto } from './draft';

const COLUMNS = 4;
const GAP = spacing.xxs;

function DownChevron() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path d="m6 9 6 6 6-6" stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

type Albums = { state: 'loading' } | { state: 'ready'; albums: RollAlbum[] } | { state: 'error' };

function CameraIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"
        stroke={palette.onInk}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={3.5} stroke={palette.onInk} strokeWidth={1.8} />
    </Svg>
  );
}

type Rolls =
  | { state: 'loading' }
  | { state: 'ready'; photos: RollPhoto[]; more: boolean }
  | {
      state: 'error';
    };

export type CameraRollGridProps = {
  /** What's picked so far, in order. Photos from the grid carry their assetId. */
  picked: DraftPhoto[];
  /** How many more can be picked before the 10 photo limit. */
  remaining: number;
  onPick: (photo: RollPhoto) => void;
  onUnpick: (assetId: string) => void;
  onCamera: () => void;
  /** The system picker, for when the member won't share their camera roll with the app. */
  onLibrary: () => void;
};

/**
 * The member's camera roll in the post screen, Instagram style: newest first, four across,
 * with the camera as the first tile. Tap to pick (numbered in order), tap again to unpick.
 */
export function CameraRollGrid({
  picked,
  remaining,
  onPick,
  onUnpick,
  onCamera,
  onLibrary,
}: CameraRollGridProps) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);
  // Asks the first time the member opens the post screen, like Instagram.
  const [permission, , getPermission] = usePermissions({
    granularPermissions: ['photo'],
    request: true,
  });
  const [rolls, setRolls] = useState<Rolls>({ state: 'loading' });
  // Recents, Favorites or one album, picked from the menu on the title.
  const [source, setSource] = useState<RollSource>(RECENTS);
  const [menu, setMenu] = useState<null | 'sources' | 'albums'>(null);
  const [albums, setAlbums] = useState<Albums>({ state: 'loading' });
  const granted = permission?.granted === true;
  const limited = permission?.accessPrivileges === 'limited';

  const load = useCallback(
    async (offset: number) => {
      try {
        const page = await loadPhotos(source, offset);
        setRolls((r) => ({
          state: 'ready',
          photos: offset > 0 && r.state === 'ready' ? [...r.photos, ...page] : page,
          more: page.length === ROLL_PAGE,
        }));
      } catch {
        setRolls((r) => (r.state === 'ready' ? r : { state: 'error' }));
      }
    },
    [source],
  );

  useEffect(() => {
    if (!granted) return;
    let live = true;
    loadPhotos(source, 0).then(
      (page) => live && setRolls({ state: 'ready', photos: page, more: page.length === ROLL_PAGE }),
      () => live && setRolls({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [granted, source]);

  // Coming back from Settings picks up a permission the member just turned on.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);

  function choose(next: RollSource) {
    setMenu(null);
    setRolls({ state: 'loading' });
    setSource(next);
  }

  function showAlbums() {
    setMenu('albums');
    setAlbums({ state: 'loading' });
    listAlbums().then(
      (list) => setAlbums({ state: 'ready', albums: list }),
      () => setAlbums({ state: 'error' }),
    );
  }

  async function selectMore() {
    await presentPermissionsPicker(['photo']).catch(() => {});
    await load(0);
  }

  const order = new Map(picked.flatMap((p, i) => (p.assetId ? [[p.assetId, i + 1]] : [])));

  if (!permission) return null;

  if (!granted) {
    return (
      <View style={styles.ask} testID="roll-no-access">
        <AppText variant="callout" color={colors.textSecondary} align="center">
          {permission.canAskAgain
            ? 'Allow photo access to pick from your camera roll here.'
            : 'Photo access is off. Turn it on in Settings to see your camera roll here.'}
        </AppText>
        {permission.canAskAgain ? (
          <Button title="Allow access" onPress={() => void getPermission()} testID="roll-allow" />
        ) : (
          <Button
            title="Open Settings"
            onPress={() => void Linking.openSettings()}
            testID="roll-settings"
          />
        )}
        <View style={styles.askRow}>
          <Button
            title="Choose photos"
            variant="secondary"
            onPress={onLibrary}
            disabled={remaining === 0}
            style={styles.flex}
            testID="roll-library"
          />
          <Button
            title="Camera"
            variant="secondary"
            onPress={onCamera}
            disabled={remaining === 0}
            style={styles.flex}
            testID="roll-camera-button"
          />
        </View>
      </View>
    );
  }

  return (
    <View testID="camera-roll">
      <View style={styles.header}>
        <Pressable
          onPress={() => setMenu('sources')}
          accessibilityRole="button"
          accessibilityLabel={`${sourceTitle(source)}, choose which photos to show`}
          style={styles.sourceButton}
          testID="roll-source"
        >
          <AppText variant="headline" numberOfLines={1} style={styles.shrink}>
            {sourceTitle(source)}
          </AppText>
          <DownChevron />
        </Pressable>
        {limited ? (
          <Pressable onPress={selectMore} accessibilityRole="button" testID="roll-select-more">
            <AppText variant="subhead" weight="600" color={colors.link}>
              Select more photos
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {rolls.state === 'error' ? (
        <AppText variant="footnote" color={colors.textSecondary} style={styles.inset}>
          Couldn’t load your photos.
        </AppText>
      ) : null}
      <View style={[styles.grid, { gap: GAP }]}>
        <Pressable
          onPress={onCamera}
          disabled={remaining === 0}
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          style={[styles.camera, { width: size, height: size }]}
          testID="roll-camera"
        >
          <CameraIcon />
        </Pressable>
        {rolls.state === 'ready'
          ? rolls.photos.map((photo) => {
              const n = order.get(photo.id);
              const full = !n && remaining === 0;
              return (
                <Pressable
                  key={photo.id}
                  onPress={() => (n ? onUnpick(photo.id) : full ? undefined : onPick(photo))}
                  accessibilityRole="button"
                  accessibilityLabel={n ? `Photo, picked ${n}` : 'Photo'}
                  accessibilityState={{ selected: !!n, disabled: full }}
                  style={{ width: size, height: size }}
                  testID={`roll-${photo.id}`}
                >
                  <Image
                    source={{ uri: photo.id }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    recyclingKey={photo.id}
                  />
                  {n || full ? <View style={styles.dim} /> : null}
                  <View style={[styles.badge, n ? styles.badgeOn : styles.badgeOff]}>
                    {n ? (
                      <AppText variant="caption" weight="700">
                        {String(n)}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          : null}
      </View>
      {rolls.state === 'ready' && rolls.photos.length === 0 ? (
        <AppText
          variant="footnote"
          color={colors.textSecondary}
          style={styles.empty}
          testID="roll-empty"
        >
          {source.kind === 'favorites' ? 'No favorite photos yet.' : 'No photos here.'}
        </AppText>
      ) : null}
      {rolls.state === 'ready' && rolls.more ? (
        <Button
          title="Show more photos"
          variant="plain"
          onPress={() => void load(rolls.photos.length)}
          testID="roll-more"
        />
      ) : null}
      <BottomSheet
        visible={menu !== null}
        onClose={() => setMenu(null)}
        title={menu === 'albums' ? 'Albums' : 'Show'}
        testID="roll-menu"
      >
        {menu === 'albums' ? (
          <ScrollView style={styles.albumList}>
            {albums.state === 'ready' && albums.albums.length > 0 ? (
              <ListSection>
                {albums.albums.map((a) => (
                  <ListRow
                    key={a.id}
                    title={a.title}
                    onPress={() => choose({ kind: 'album', id: a.id, title: a.title })}
                    testID={`roll-album-${a.id}`}
                  />
                ))}
              </ListSection>
            ) : (
              <AppText variant="callout" color={colors.textSecondary} align="center">
                {albums.state === 'loading'
                  ? 'Loading…'
                  : albums.state === 'error'
                    ? 'Couldn’t load your albums.'
                    : 'No albums yet.'}
              </AppText>
            )}
          </ScrollView>
        ) : (
          <ListSection>
            <ListRow title="Recents" onPress={() => choose(RECENTS)} testID="roll-show-recents" />
            <ListRow
              title="Favorites"
              onPress={() => choose({ kind: 'favorites' })}
              testID="roll-show-favorites"
            />
            <ListRow
              title="All albums"
              showChevron
              onPress={showAlbums}
              testID="roll-show-albums"
            />
          </ListSection>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inset: { paddingHorizontal: spacing.lg },
  ask: { gap: spacing.md, paddingVertical: spacing.lg },
  askRow: { flexDirection: 'row', gap: spacing.sm },
  shrink: { flexShrink: 1 },
  empty: { paddingVertical: spacing.lg, textAlign: 'center' },
  albumList: { maxHeight: 360 },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  // Edge to edge, like Instagram: undo the screen's side padding.
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.lg },
  camera: { backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: spacing.xl + spacing.xxs,
    height: spacing.xl + spacing.xxs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOn: { backgroundColor: palette.gold, borderWidth: 1.5, borderColor: palette.onInk },
  badgeOff: { borderWidth: 1.5, borderColor: palette.onInk, backgroundColor: colors.scrim },
});

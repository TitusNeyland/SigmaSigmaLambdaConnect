import { Album, AlbumType, Asset, AssetField, MediaType, Query } from 'expo-media-library';

import type { DraftPhoto } from './draft';

/**
 * A photo in the member's camera roll. The id doubles as a thumbnail URI (`ph://` on iOS,
 * `content://` on Android) that expo-image can show without copying the file.
 */
export type RollPhoto = { id: string; width: number; height: number };

/** Which photos the grid shows, like Instagram's Recents menu. */
export type RollSource =
  { kind: 'recents' } | { kind: 'favorites' } | { kind: 'album'; id: string; title: string };

export const RECENTS: RollSource = { kind: 'recents' };

export function sourceTitle(source: RollSource): string {
  if (source.kind === 'recents') return 'Recents';
  if (source.kind === 'favorites') return 'Favorites';
  return source.title;
}

/** How many photos the grid loads at a time. */
export const ROLL_PAGE = 60;

/**
 * Photos from a source, newest first, a page at a time. Only photos: posts can't hold
 * videos, so videos and other media are left out everywhere.
 */
export async function loadPhotos(
  source: RollSource,
  offset: number,
  count = ROLL_PAGE,
): Promise<RollPhoto[]> {
  let query = new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE);
  if (source.kind === 'favorites') query = query.eq(AssetField.IS_FAVORITE, true);
  if (source.kind === 'album') query = query.album(new Album(source.id));
  const found = await query
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .offset(offset)
    .limit(count)
    .exeForMetadata();
  return found.map((a) => ({ id: a.id, width: a.width ?? 0, height: a.height ?? 0 }));
}

/** The newest photos in the whole camera roll. */
export const loadRecentPhotos = (offset: number, count = ROLL_PAGE) =>
  loadPhotos(RECENTS, offset, count);

export type RollAlbum = { id: string; title: string };

/**
 * The member's own albums, by name. iOS smart albums (Videos, Screenshots, Recents...) are
 * left out: Recents and Favorites have their own entries, and some hold only videos.
 */
export async function listAlbums(): Promise<RollAlbum[]> {
  const albums = await Album.getAlbumsMetadata();
  return albums
    .filter((a) => a.type !== AlbumType.SMART_ALBUM && a.title.trim())
    .map((a) => ({ id: a.id, title: a.title.trim() }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Turns a camera roll photo into one the post can use: a file URI the upload can resize and
 * send. Keeps the asset id so the grid knows it's picked.
 */
export async function toDraftPhoto(photo: RollPhoto): Promise<DraftPhoto> {
  const uri = await new Asset(photo.id).getUri();
  return { uri, width: photo.width, height: photo.height, assetId: photo.id };
}

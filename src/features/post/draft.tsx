import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { DirectoryEntry } from '@/data/directory';
import type { EventSummary } from '@/data/events';
import { LIMITS } from '@/data/types';

import { frameAspect, type Crop, type FrameShape } from './cropLogic';

export const MAX_PHOTOS = LIMITS.photosPerPost;

/** A photo picked for a post, in the order it will show. */
export type DraftPhoto = {
  uri: string;
  width: number;
  height: number;
  /** Set when picked from the in-app camera roll grid, so the grid can show it as picked. */
  assetId?: string;
  /** How the member framed it. Unset means the middle of the photo. */
  crop?: Crop;
};

/** What the caption step sets. Kept in the draft so going back a step doesn't lose it. */
export type PostDetails = {
  caption: string;
  allowComments: boolean;
  official: boolean;
  event: EventSummary | null;
  tags: DirectoryEntry[];
};

export type PostDraft = {
  photos: DraftPhoto[];
  /** The frame every photo in the post shares. */
  shape: FrameShape;
  details: PostDetails;
};

/** Width over height of the post's frame. */
export const draftAspect = (draft: PostDraft) => frameAspect(draft.shape, draft.photos[0]);

/** Framing only fits the frame it was made for, so a new frame starts photos centered. */
const uncropped = (photos: DraftPhoto[]) => photos.map(({ crop: _crop, ...p }) => p);

/** Adds picks after what's there, skipping repeats, up to the 10 photo limit. */
export function addPhotos(current: DraftPhoto[], picked: DraftPhoto[]): DraftPhoto[] {
  const seen = new Set(current.map((p) => p.uri));
  const fresh = picked.filter((p) => !seen.has(p.uri));
  return [...current, ...fresh].slice(0, MAX_PHOTOS);
}

export function removePhoto(current: DraftPhoto[], uri: string): DraftPhoto[] {
  return current.filter((p) => p.uri !== uri);
}

/** Moves a photo to the front, so it becomes the cover the feed shows first (#32). */
export function makeCover(current: DraftPhoto[], uri: string): DraftPhoto[] {
  const photo = current.find((p) => p.uri === uri);
  return photo ? [photo, ...current.filter((p) => p.uri !== uri)] : current;
}

type DraftContext = {
  draft: PostDraft;
  setPhotos: (update: (photos: DraftPhoto[]) => DraftPhoto[]) => void;
  setShape: (shape: FrameShape) => void;
  /** Saves how each photo is framed, by uri. */
  setCrops: (crops: Record<string, Crop>) => void;
  setDetails: (patch: Partial<PostDetails>) => void;
  reset: () => void;
};

const EMPTY: PostDraft = {
  photos: [],
  shape: 'original',
  details: { caption: '', allowComments: true, official: false, event: null, tags: [] },
};
const Context = createContext<DraftContext | null>(null);

/**
 * Holds the post being made across its steps (photos, editor, caption), including while the
 * member opens other screens like the guidelines.
 */
export function PostDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<PostDraft>(EMPTY);
  const value = useMemo<DraftContext>(
    () => ({
      draft,
      setPhotos: (update) =>
        setDraft((d) => {
          const photos = update(d.photos);
          // With Original, the first photo sets the frame: a new one resets the framing.
          const reframed = d.shape === 'original' && photos[0]?.uri !== d.photos[0]?.uri;
          return { ...d, photos: reframed ? uncropped(photos) : photos };
        }),
      setShape: (shape) =>
        setDraft((d) => (d.shape === shape ? d : { ...d, shape, photos: uncropped(d.photos) })),
      setCrops: (crops) =>
        setDraft((d) => ({
          ...d,
          photos: d.photos.map((p) => (crops[p.uri] ? { ...p, crop: crops[p.uri] } : p)),
        })),
      setDetails: (patch) => setDraft((d) => ({ ...d, details: { ...d.details, ...patch } })),
      reset: () => setDraft(EMPTY),
    }),
    [draft],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePostDraft(): DraftContext {
  const value = useContext(Context);
  if (!value) throw new Error('usePostDraft must be used inside PostDraftProvider');
  return value;
}

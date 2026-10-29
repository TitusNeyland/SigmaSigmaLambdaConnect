import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { LIMITS } from '@/data/types';

export const MAX_PHOTOS = LIMITS.photosPerPost;

/** A photo picked for a post, in the order it will show. */
export type DraftPhoto = { uri: string; width: number; height: number };

export type PostDraft = {
  photos: DraftPhoto[];
  /** Chose to write without photos. */
  textOnly: boolean;
};

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
  setTextOnly: (textOnly: boolean) => void;
  reset: () => void;
};

const EMPTY: PostDraft = { photos: [], textOnly: false };
const Context = createContext<DraftContext | null>(null);

/** Holds the post being made while the member moves between the pick and compose screens. */
export function PostDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<PostDraft>(EMPTY);
  const value = useMemo<DraftContext>(
    () => ({
      draft,
      setPhotos: (update) => setDraft((d) => ({ ...d, photos: update(d.photos), textOnly: false })),
      setTextOnly: (textOnly) => setDraft((d) => ({ ...d, textOnly })),
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

import {
  collection,
  collectionGroup,
  count,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  limit,
  serverTimestamp,
  updateDoc,
  onSnapshot,
  orderBy,
  query,
  sum,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from './firebase';

/** What a profile screen shows about someone. */
export type Profile = {
  displayName: string;
  initiationTerm: string;
  headline: string;
  bio: string;
  interests: string[];
  photoURL: string | null;
  email: string;
  phone: string;
  showEmail: boolean;
  showPhone: boolean;
};

export type ProfileStats = {
  posts: number;
  /** Only known for the member themself and officers; null otherwise. */
  eventsAttended: number | null;
  serviceHours: number | null;
};

export type ProfilePost = {
  id: string;
  /** Storage path of the first photo, or null for a text-only post. */
  coverPath: string | null;
  photoCount: number;
  caption: string;
};

export type ActivityItem = {
  eventId: string;
  title: string;
  startsAt: Date | null;
  location: string;
  serviceHours: number;
};

const text = (value: unknown) => (typeof value === 'string' ? value : '');

export function toProfile(data: Record<string, unknown>): Profile {
  return {
    displayName: text(data.displayName),
    initiationTerm: text(data.initiationTerm),
    headline: text(data.headline),
    bio: text(data.bio),
    interests: Array.isArray(data.interests)
      ? data.interests.filter((i): i is string => typeof i === 'string' && i.trim() !== '')
      : [],
    photoURL: typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : null,
    email: text(data.email),
    phone: text(data.phone),
    showEmail: data.showEmail === true,
    showPhone: data.showPhone === true,
  };
}

/** Live profile for one member. Null if the profile doesn't exist. */
export function subscribeToProfile(
  uid: string,
  onChange: (profile: Profile | null) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, 'members', uid),
    (snap) => onChange(snap.exists() ? toProfile(snap.data()) : null),
    onError,
  );
}

function visiblePostsQuery(uid: string) {
  return query(
    collection(db, 'posts'),
    where('authorId', '==', uid),
    where('removed', '==', false),
  );
}

function attendanceQuery(uid: string) {
  return query(collectionGroup(db, 'attendance'), where('memberId', '==', uid));
}

/**
 * Counts for the top of a profile. Attendance is private to the member and officers, so
 * pass includeAttendance only for the signed-in member's own profile (or an officer).
 */
export async function fetchProfileStats(
  uid: string,
  options: { includeAttendance: boolean },
): Promise<ProfileStats> {
  const posts = getAggregateFromServer(visiblePostsQuery(uid), { posts: count() });
  if (!options.includeAttendance) {
    return { posts: (await posts).data().posts, eventsAttended: null, serviceHours: null };
  }
  const attendance = getAggregateFromServer(attendanceQuery(uid), {
    events: count(),
    hours: sum('serviceHours'),
  });
  const [p, a] = await Promise.all([posts, attendance]);
  return {
    posts: p.data().posts,
    eventsAttended: a.data().events,
    serviceHours: a.data().hours ?? 0,
  };
}

/** Newest posts first, for the profile grid. */
export async function fetchProfilePosts(uid: string, max = 30): Promise<ProfilePost[]> {
  const snap = await getDocs(
    query(visiblePostsQuery(uid), orderBy('createdAt', 'desc'), limit(max)),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    const paths = Array.isArray(data.photoPaths)
      ? data.photoPaths.filter((p): p is string => typeof p === 'string')
      : [];
    return {
      id: d.id,
      coverPath: paths[0] ?? null,
      photoCount: paths.length,
      caption: text(data.caption),
    };
  });
}

/**
 * Events the member was checked in at, newest first. Reads each event for its title;
 * events that were deleted are skipped.
 */
export async function fetchActivity(uid: string, max = 50): Promise<ActivityItem[]> {
  const snap = await getDocs(
    query(attendanceQuery(uid), orderBy('checkedInAt', 'desc'), limit(max)),
  );
  const items = await Promise.all(
    snap.docs.map(async (d): Promise<ActivityItem | null> => {
      const eventRef = d.ref.parent.parent;
      if (!eventRef) return null;
      const event = await getDoc(eventRef);
      if (!event.exists()) return null;
      const data = event.data();
      const hours = d.data().serviceHours;
      return {
        eventId: event.id,
        title: text(data.title),
        startsAt: (data.startsAt as Timestamp | undefined)?.toDate?.() ?? null,
        location: text(data.location),
        serviceHours: typeof hours === 'number' ? hours : 0,
      };
    }),
  );
  return items.filter((i): i is ActivityItem => i !== null);
}

/** Download URL for a photo in Storage. */
export function photoUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}

/** Fields a member edits on the Edit profile screen. Email comes from their account. */
export type ProfilePatch = {
  displayName: string;
  initiationTerm: string;
  headline: string;
  bio: string;
  interests: string[];
  phone: string;
  showEmail: boolean;
  showPhone: boolean;
};

/** Saves the member's own profile. The rules only allow these fields, never status. */
export async function updateOwnProfile(uid: string, patch: ProfilePatch): Promise<void> {
  await updateDoc(doc(db, 'members', uid), { ...patch, updatedAt: serverTimestamp() });
}

/**
 * Uploads a prepared (cropped, resized) JPEG as the member's photo and saves its URL on
 * their profile. Returns the new URL.
 */
export async function uploadAvatar(uid: string, localUri: string): Promise<string> {
  const blob = await (await fetch(localUri)).blob();
  const fileRef = ref(storage, `avatars/${uid}/${Date.now()}.jpg`);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(fileRef);
  await updateDoc(doc(db, 'members', uid), { photoURL: url, updatedAt: serverTimestamp() });
  return url;
}

/** Clears the member's photo. Their initials show instead. */
export async function removeAvatar(uid: string): Promise<void> {
  await updateDoc(doc(db, 'members', uid), { photoURL: null, updatedAt: serverTimestamp() });
}

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
  deleteField,
  onSnapshot,
  writeBatch,
  orderBy,
  query,
  sum,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from './firebase';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from './types';

/**
 * What a profile screen shows about someone. For other members, email and phone are only
 * filled in when that member chose to show them. On the member's own profile they hold the
 * real values from their private contact doc, with the show switches.
 */
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
  notificationPrefs: NotificationPrefs;
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
    // The public doc only carries contact details the member chose to show.
    showEmail: text(data.email) !== '',
    showPhone: text(data.phone) !== '',
    notificationPrefs: toNotificationPrefs(data.notificationPrefs),
  };
}

/** Reads stored preferences, using the defaults for anything missing or malformed. */
export function toNotificationPrefs(value: unknown): NotificationPrefs {
  const stored = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const key of Object.keys(prefs) as (keyof NotificationPrefs)[]) {
    if (typeof stored[key] === 'boolean') prefs[key] = stored[key] as boolean;
  }
  return prefs;
}

/** Turns one kind of push notification on or off for the member. */
export async function setNotificationPref(
  uid: string,
  key: keyof NotificationPrefs,
  value: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'members', uid), {
    [`notificationPrefs.${key}`]: value,
    updatedAt: serverTimestamp(),
  });
}

/**
 * The member's private contact settings. Only they can read it, so a hidden phone number or
 * email never reaches other members. The public member doc copies just the shown values.
 */
export type ContactSettings = {
  email: string;
  phone: string;
  showEmail: boolean;
  showPhone: boolean;
};

export const contactDocPath = (uid: string) => `members/${uid}/private/contact`;

export function toContact(data: Record<string, unknown>): ContactSettings {
  return {
    email: text(data.email),
    phone: text(data.phone),
    showEmail: data.showEmail === true,
    showPhone: data.showPhone === true,
  };
}

/** The member's own profile with their real contact details layered on. */
export function withContact(profile: Profile, contact: ContactSettings | null): Profile {
  if (!contact) return profile;
  return { ...profile, ...contact, email: contact.email || profile.email };
}

/**
 * Live profile for one member. Null if the profile doesn't exist. Pass own for the
 * signed-in member's own profile to include their private contact settings.
 */
export function subscribeToProfile(
  uid: string,
  onChange: (profile: Profile | null) => void,
  onError: (error: unknown) => void,
  options: { own?: boolean } = {},
): () => void {
  if (!options.own) {
    return onSnapshot(
      doc(db, 'members', uid),
      (snap) => onChange(snap.exists() ? toProfile(snap.data()) : null),
      onError,
    );
  }

  let profile: Profile | null | undefined;
  let contact: ContactSettings | null | undefined;
  const emit = () => {
    if (profile === undefined || contact === undefined) return;
    onChange(profile && withContact(profile, contact));
  };
  const stopProfile = onSnapshot(
    doc(db, 'members', uid),
    (snap) => {
      profile = snap.exists() ? toProfile(snap.data()) : null;
      emit();
    },
    onError,
  );
  const stopContact = onSnapshot(
    doc(db, contactDocPath(uid)),
    (snap) => {
      contact = snap.exists() ? toContact(snap.data()) : null;
      emit();
    },
    onError,
  );
  return () => {
    stopProfile();
    stopContact();
  };
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

/**
 * Saves the member's own profile. Contact details go to their private doc; the public
 * member doc gets the email and phone only when the matching switch is on.
 */
export async function updateOwnProfile(
  uid: string,
  patch: ProfilePatch,
  account: { email: string },
): Promise<void> {
  const { phone, showEmail, showPhone, ...fields } = patch;
  const email = account.email.trim();
  const batch = writeBatch(db);
  batch.set(doc(db, contactDocPath(uid)), {
    email,
    phone,
    showEmail,
    showPhone,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'members', uid), {
    ...fields,
    email: showEmail && email ? email : deleteField(),
    phone: showPhone && phone ? phone : deleteField(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
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

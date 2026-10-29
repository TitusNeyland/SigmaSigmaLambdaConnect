import {
  collection,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from './firebase';
import type { EventCategory } from './types';

/** What the officer create and edit form saves (#27). Officers only; the rules enforce it. */
export type EventInput = {
  title: string;
  category: EventCategory;
  location: string;
  address: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  rsvpDeadline: Date;
  feeCents: number;
  photoURL: string | null;
};

/** A new event's ID, made up front so its photo can be uploaded under it before saving. */
export function newEventId(): string {
  return doc(collection(db, 'events')).id;
}

function fields(input: EventInput) {
  return {
    title: input.title,
    category: input.category,
    location: input.location,
    description: input.description,
    startsAt: Timestamp.fromDate(input.startsAt),
    rsvpDeadline: Timestamp.fromDate(input.rsvpDeadline),
    feeCents: input.feeCents,
    photoURL: input.photoURL,
  };
}

/** Creates the event. A Cloud Function then tells the chapter about it (#26). */
export async function createEvent(id: string, uid: string, input: EventInput): Promise<void> {
  await setDoc(doc(db, 'events', id), {
    ...fields(input),
    ...(input.address ? { address: input.address } : {}),
    ...(input.endsAt ? { endsAt: Timestamp.fromDate(input.endsAt) } : {}),
    cancelled: false,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
}

/** Saves edits. Clearing the address or end time removes them. */
export async function updateEvent(id: string, input: EventInput): Promise<void> {
  await updateDoc(doc(db, 'events', id), {
    ...fields(input),
    address: input.address ? input.address : deleteField(),
    endsAt: input.endsAt ? Timestamp.fromDate(input.endsAt) : deleteField(),
  });
}

/**
 * Cancels the event. It stays listed as cancelled so people who RSVPed see it, RSVPs lock,
 * and a Cloud Function tells Going and Maybe RSVPs.
 */
export async function cancelEvent(id: string): Promise<void> {
  await updateDoc(doc(db, 'events', id), { cancelled: true });
}

/** Uploads a prepared JPEG as the event's photo and returns its URL. */
export async function uploadEventPhoto(id: string, localUri: string): Promise<string> {
  const blob = await (await fetch(localUri)).blob();
  const fileRef = ref(storage, `events/${id}/${Date.now()}.jpg`);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(fileRef);
}

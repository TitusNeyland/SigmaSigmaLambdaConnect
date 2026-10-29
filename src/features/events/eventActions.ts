// The system "new event" sheet needs no calendar permission on iOS or Android, so the app
// never asks to read anyone's calendar. The class-based API in expo-calendar does need it.
import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import { Linking, Platform } from 'react-native';

import type { EventDetail } from '@/data/events';

/** An event with no end time is put in the calendar as 3 hours long. */
const DEFAULT_LENGTH_MS = 3 * 3600_000;

/** What goes into the phone's calendar for a chapter event. */
export function calendarEntry(event: EventDetail) {
  return {
    title: event.title,
    startDate: event.startsAt,
    endDate: event.endsAt ?? new Date(event.startsAt.getTime() + DEFAULT_LENGTH_MS),
    location: [event.location, event.address].filter(Boolean).join(', '),
    notes: event.description.trim(),
  };
}

export type AddToCalendarResult = 'added' | 'canceled' | 'failed';

/**
 * Opens the system sheet to add the event to the phone's calendar. Android can't say
 * whether it was saved, so "done" counts as added there.
 */
export async function addToCalendar(event: EventDetail): Promise<AddToCalendarResult> {
  try {
    const { action } = await createEventInCalendarAsync(calendarEntry(event));
    return action === 'saved' || action === 'done' ? 'added' : 'canceled';
  } catch {
    return 'failed';
  }
}

/** Where to drive to: the street address when there is one, otherwise the place name. */
export function destination(event: Pick<EventDetail, 'location' | 'address'>): string {
  return (event.address || event.location).trim();
}

/** Apple Maps on iOS, Google Maps everywhere else. Both open their app when installed. */
export function directionsUrl(place: string, os: string = Platform.OS): string {
  const q = encodeURIComponent(place);
  return os === 'ios'
    ? `https://maps.apple.com/?daddr=${q}`
    : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export async function openDirections(event: EventDetail): Promise<boolean> {
  const place = destination(event);
  if (!place) return false;
  try {
    await Linking.openURL(directionsUrl(place));
    return true;
  } catch {
    return false;
  }
}

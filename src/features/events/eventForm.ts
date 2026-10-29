import type { EventDetail } from '@/data/events';
import type { EventInput } from '@/data/eventAdmin';
import type { EventCategory } from '@/data/types';

/** What the create and edit form holds while it's being filled in. */
export type EventForm = {
  title: string;
  category: EventCategory;
  location: string;
  address: string;
  description: string;
  startsAt: Date;
  /** Null means no end time. */
  endsAt: Date | null;
  rsvpDeadline: Date;
  /** Typed dollars, like "25" or "12.50". Empty means free. */
  fee: string;
  photoURL: string | null;
};

export type EventFormErrors = Partial<Record<keyof EventForm, string>>;

export const MAX_TITLE = 100;
export const MAX_LOCATION = 120;
export const MAX_ADDRESS = 200;
export const MAX_DESCRIPTION = 2000;
/** A sanity cap; chapter events don't cost more than this. */
export const MAX_FEE_DOLLARS = 1000;

const HOUR = 3600_000;

/** A blank form: next week at 7 PM, two hours long, RSVPs due the day before. */
export function blankForm(now: Date): EventForm {
  const start = new Date(now);
  start.setDate(start.getDate() + 7);
  start.setHours(19, 0, 0, 0);
  return {
    title: '',
    category: 'meeting',
    location: '',
    address: '',
    description: '',
    startsAt: start,
    endsAt: new Date(start.getTime() + 2 * HOUR),
    rsvpDeadline: new Date(start.getTime() - 24 * HOUR),
    fee: '',
    photoURL: null,
  };
}

export function formFromEvent(event: EventDetail): EventForm {
  return {
    title: event.title,
    category: event.category,
    location: event.location,
    address: event.address,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    rsvpDeadline: event.rsvpDeadline ?? new Date(event.startsAt.getTime() - 24 * HOUR),
    fee: event.feeCents > 0 ? centsToDollars(event.feeCents) : '',
    photoURL: event.photoURL,
  };
}

export function centsToDollars(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** "25" -> 2500, "$12.5" -> 1250, "" -> 0. Null when it isn't a price. */
export function parseFee(fee: string): number | null {
  const cleaned = fee.trim().replace(/^\$/, '').replace(/,/g, '');
  if (cleaned === '') return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/**
 * Moves the start and keeps the event's length and how long before it RSVPs close, so
 * changing the date doesn't leave the end or deadline behind.
 */
export function moveStart(form: EventForm, startsAt: Date): EventForm {
  const shift = startsAt.getTime() - form.startsAt.getTime();
  return {
    ...form,
    startsAt,
    endsAt: form.endsAt ? new Date(form.endsAt.getTime() + shift) : null,
    rsvpDeadline: new Date(form.rsvpDeadline.getTime() + shift),
  };
}

/** Field errors, in plain words. Empty when the form can be saved. */
export function validateEventForm(
  form: EventForm,
  options: { now: Date; isNew: boolean },
): EventFormErrors {
  const errors: EventFormErrors = {};
  const title = form.title.trim();
  if (!title) errors.title = 'Give the event a name.';
  else if (title.length > MAX_TITLE) errors.title = `Keep it under ${MAX_TITLE} characters.`;

  const location = form.location.trim();
  if (!location) errors.location = 'Where is it?';
  else if (location.length > MAX_LOCATION) {
    errors.location = `Keep it under ${MAX_LOCATION} characters.`;
  }
  if (form.address.trim().length > MAX_ADDRESS) {
    errors.address = `Keep it under ${MAX_ADDRESS} characters.`;
  }
  if (form.description.trim().length > MAX_DESCRIPTION) {
    errors.description = `Keep it under ${MAX_DESCRIPTION} characters.`;
  }

  if (options.isNew && form.startsAt.getTime() <= options.now.getTime()) {
    errors.startsAt = 'Pick a time in the future.';
  }
  if (form.endsAt && form.endsAt.getTime() <= form.startsAt.getTime()) {
    errors.endsAt = 'The end has to be after the start.';
  }
  if (form.rsvpDeadline.getTime() > form.startsAt.getTime()) {
    errors.rsvpDeadline = 'RSVPs have to close by the time it starts.';
  }

  const cents = parseFee(form.fee);
  if (cents === null) errors.fee = 'Enter a price like 25 or 12.50, or leave it empty.';
  else if (cents > MAX_FEE_DOLLARS * 100)
    errors.fee = `Fees over $${MAX_FEE_DOLLARS} aren’t allowed.`;
  return errors;
}

export const hasErrors = (errors: EventFormErrors) => Object.keys(errors).length > 0;

/** The trimmed values to save. Only call once validateEventForm finds nothing. */
export function toEventInput(form: EventForm): EventInput {
  return {
    title: form.title.trim(),
    category: form.category,
    location: form.location.trim(),
    address: form.address.trim(),
    description: form.description.trim(),
    startsAt: form.startsAt,
    endsAt: form.endsAt,
    rsvpDeadline: form.rsvpDeadline,
    feeCents: parseFee(form.fee) ?? 0,
    photoURL: form.photoURL,
  };
}

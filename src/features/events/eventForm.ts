import type { EventDetail } from '@/data/events';
import type { EventInput } from '@/data/eventAdmin';
import { MAX_SLOTS, type EventCategory } from '@/data/types';

import { formatDay, formatTime, formatTimeRange } from './eventsLogic';

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
  /** Typed number of brothers needed, like "10". Empty means no number. */
  slots: string;
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
    slots: '',
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
    slots: event.slots ? String(event.slots) : '',
  };
}

/** "10" -> 10, "" -> null (no number). Undefined when it isn't a whole number 1 to 500. */
export function parseSlots(slots: string): number | null | undefined {
  const cleaned = slots.trim();
  if (cleaned === '') return null;
  if (!/^\d+$/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return n >= 1 && n <= MAX_SLOTS ? n : undefined;
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
  } else if (options.isNew && form.rsvpDeadline.getTime() <= options.now.getTime()) {
    // Like a week-before deadline on an event three days out.
    errors.rsvpDeadline = 'RSVPs would already be closed. Pick a later deadline.';
  }

  const cents = parseFee(form.fee);
  if (cents === null) errors.fee = 'Enter a price like 25 or 12.50, or leave it empty.';
  else if (cents > MAX_FEE_DOLLARS * 100)
    errors.fee = `Fees over $${MAX_FEE_DOLLARS} aren’t allowed.`;
  if (parseSlots(form.slots) === undefined) {
    errors.slots = `Enter a number from 1 to ${MAX_SLOTS}, or leave it empty.`;
  }
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
    slots: parseSlots(form.slots) ?? null,
  };
}

/** How long it runs, as one tap instead of a second date picker. */
export type LengthChoice = 'none' | '1h' | '2h' | '3h' | 'custom';

export const LENGTH_OPTIONS: readonly { value: LengthChoice; label: string }[] = [
  { value: 'none', label: 'No end time' },
  { value: '1h', label: '1 hr' },
  { value: '2h', label: '2 hrs' },
  { value: '3h', label: '3 hrs' },
  { value: 'custom', label: 'Custom' },
];

const LENGTH_HOURS: Partial<Record<LengthChoice, number>> = { '1h': 1, '2h': 2, '3h': 3 };

/** Which length choice the form's end time matches. Anything else is custom. */
export function lengthChoice(form: EventForm): LengthChoice {
  if (!form.endsAt) return 'none';
  const hours = (form.endsAt.getTime() - form.startsAt.getTime()) / HOUR;
  const match = (Object.keys(LENGTH_HOURS) as LengthChoice[]).find(
    (k) => LENGTH_HOURS[k] === hours,
  );
  return match ?? 'custom';
}

/** Sets the end time from a length choice. Custom keeps the end, or starts at two hours. */
export function applyLength(form: EventForm, choice: LengthChoice): EventForm {
  if (choice === 'none') return { ...form, endsAt: null };
  if (choice === 'custom') {
    return { ...form, endsAt: form.endsAt ?? new Date(form.startsAt.getTime() + 2 * HOUR) };
  }
  return { ...form, endsAt: new Date(form.startsAt.getTime() + LENGTH_HOURS[choice]! * HOUR) };
}

/** When RSVPs close, as one tap instead of working out a date and time. */
export type RsvpChoice = 'start' | 'day' | 'twoDays' | 'week' | 'custom';

export const RSVP_OPTIONS: readonly { value: RsvpChoice; label: string }[] = [
  { value: 'start', label: 'Until it starts' },
  { value: 'day', label: 'Day before' },
  { value: 'twoDays', label: '2 days before' },
  { value: 'week', label: 'Week before' },
  { value: 'custom', label: 'Custom' },
];

const RSVP_HOURS_BEFORE: Partial<Record<RsvpChoice, number>> = {
  start: 0,
  day: 24,
  twoDays: 48,
  week: 168,
};

export function rsvpChoice(form: EventForm): RsvpChoice {
  const hours = (form.startsAt.getTime() - form.rsvpDeadline.getTime()) / HOUR;
  const match = (Object.keys(RSVP_HOURS_BEFORE) as RsvpChoice[]).find(
    (k) => RSVP_HOURS_BEFORE[k] === hours,
  );
  return match ?? 'custom';
}

/** Sets the RSVP deadline from a choice. Custom keeps the deadline as it is. */
export function applyRsvp(form: EventForm, choice: RsvpChoice): EventForm {
  if (choice === 'custom') return form;
  return {
    ...form,
    rsvpDeadline: new Date(form.startsAt.getTime() - RSVP_HOURS_BEFORE[choice]! * HOUR),
  };
}

/**
 * The When section in one line, so the dates read like a sentence: "Sat, Nov 14, 7:00 to
 * 9:00 PM. RSVPs close Fri, Nov 13, 7:00 PM."
 */
export function whenSummary(form: EventForm, now: Date): string {
  const when = `${formatDay(form.startsAt, now)}, ${formatTimeRange(form.startsAt, form.endsAt)}.`;
  const rsvp =
    form.rsvpDeadline.getTime() === form.startsAt.getTime()
      ? 'RSVPs stay open until it starts.'
      : `RSVPs close ${formatDay(form.rsvpDeadline, now)}, ${formatTime(form.rsvpDeadline)}.`;
  return `${when} ${rsvp}`;
}

/** The form's sections, top to bottom, so saving can scroll to the first problem. */
export type FormSection = 'what' | 'when' | 'where' | 'extras';

const FIELD_SECTION: Record<keyof EventForm, FormSection> = {
  title: 'what',
  category: 'what',
  photoURL: 'what',
  startsAt: 'when',
  endsAt: 'when',
  rsvpDeadline: 'when',
  location: 'where',
  address: 'where',
  fee: 'extras',
  slots: 'extras',
  description: 'extras',
};

const SECTION_ORDER: readonly FormSection[] = ['what', 'when', 'where', 'extras'];

/** The first section, top to bottom, with something to fix. */
export function firstErrorSection(errors: EventFormErrors): FormSection | null {
  const sections = new Set(
    (Object.keys(errors) as (keyof EventForm)[]).map((k) => FIELD_SECTION[k]),
  );
  return SECTION_ORDER.find((s) => sections.has(s)) ?? null;
}

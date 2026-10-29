import type { EventDetail } from '@/data/events';

import {
  blankForm,
  centsToDollars,
  formFromEvent,
  hasErrors,
  moveStart,
  parseFee,
  toEventInput,
  validateEventForm,
  type EventForm,
} from './eventForm';

const NOW = new Date(2026, 9, 29, 12); // Thu, Oct 29 2026
const HOUR = 3600_000;

const valid = (overrides: Partial<EventForm> = {}): EventForm => ({
  ...blankForm(NOW),
  title: 'Scholarship gala',
  location: 'Hotel ballroom',
  ...overrides,
});

describe('blankForm', () => {
  it('starts next week at 7 PM, two hours long, with RSVPs due the day before', () => {
    const form = blankForm(NOW);
    expect(form.startsAt).toEqual(new Date(2026, 10, 5, 19));
    expect(form.endsAt).toEqual(new Date(2026, 10, 5, 21));
    expect(form.rsvpDeadline).toEqual(new Date(2026, 10, 4, 19));
    expect(form).toMatchObject({ title: '', category: 'meeting', fee: '', photoURL: null });
  });
});

describe('fees', () => {
  it.each([
    ['', 0],
    ['  ', 0],
    ['25', 2500],
    ['$25', 2500],
    ['12.5', 1250],
    ['12.50', 1250],
    ['1,000', 100000],
    ['0', 0],
  ])('parseFee(%j) is %i cents', (fee, cents) => expect(parseFee(fee)).toBe(cents));

  it.each(['abc', '12.345', '-5', '5 dollars'])('rejects %j', (fee) =>
    expect(parseFee(fee)).toBeNull(),
  );

  it('shows cents as dollars', () => {
    expect(centsToDollars(2500)).toBe('25');
    expect(centsToDollars(1250)).toBe('12.50');
  });
});

describe('moveStart', () => {
  it('moves the end and deadline with the start', () => {
    const form = blankForm(NOW);
    const later = new Date(form.startsAt.getTime() + 3 * 24 * HOUR);
    const moved = moveStart(form, later);
    expect(moved.startsAt).toEqual(later);
    expect(moved.endsAt!.getTime() - later.getTime()).toBe(2 * HOUR);
    expect(later.getTime() - moved.rsvpDeadline.getTime()).toBe(24 * HOUR);
    expect(moveStart({ ...form, endsAt: null }, later).endsAt).toBeNull();
  });
});

describe('validateEventForm', () => {
  const check = (form: EventForm, isNew = true) => validateEventForm(form, { now: NOW, isNew });

  it('accepts a complete form', () => {
    expect(check(valid())).toEqual({});
    expect(hasErrors(check(valid()))).toBe(false);
  });

  it('needs a title and a place, within limits', () => {
    expect(check(valid({ title: '  ', location: '' }))).toMatchObject({
      title: 'Give the event a name.',
      location: 'Where is it?',
    });
    expect(check(valid({ title: 'a'.repeat(101) })).title).toMatch(/under 100/);
    expect(check(valid({ location: 'a'.repeat(121) })).location).toMatch(/under 120/);
    expect(check(valid({ address: 'a'.repeat(201) })).address).toMatch(/under 200/);
    expect(check(valid({ description: 'a'.repeat(2001) })).description).toMatch(/under 2000/);
  });

  it('keeps times in order', () => {
    const form = valid();
    expect(check({ ...form, endsAt: new Date(form.startsAt.getTime() - HOUR) }).endsAt).toBe(
      'The end has to be after the start.',
    );
    expect(
      check({ ...form, rsvpDeadline: new Date(form.startsAt.getTime() + HOUR) }).rsvpDeadline,
    ).toBe('RSVPs have to close by the time it starts.');
    expect(check({ ...form, rsvpDeadline: form.startsAt })).toEqual({});
  });

  it('needs a future start for new events, but lets you edit a past one', () => {
    const past = valid({
      startsAt: new Date(NOW.getTime() - HOUR),
      endsAt: null,
      rsvpDeadline: new Date(NOW.getTime() - 2 * HOUR),
    });
    expect(check(past).startsAt).toBe('Pick a time in the future.');
    expect(check(past, false)).toEqual({});
  });

  it('checks the fee', () => {
    expect(check(valid({ fee: 'abc' })).fee).toMatch(/^Enter a price/);
    expect(check(valid({ fee: '1001' })).fee).toMatch(/over \$1000/);
    expect(check(valid({ fee: '1000' }))).toEqual({});
  });
});

describe('to and from saved events', () => {
  it('trims what it saves and turns the fee into cents', () => {
    expect(
      toEventInput(
        valid({ title: '  Gala ', location: ' Ballroom ', address: ' ', fee: '$12.50' }),
      ),
    ).toMatchObject({ title: 'Gala', location: 'Ballroom', address: '', feeCents: 1250 });
  });

  it('fills the form from an existing event', () => {
    const event = {
      id: 'gala',
      title: 'Gala',
      category: 'fundraiser',
      description: 'About',
      startsAt: new Date(2026, 10, 7, 19),
      endsAt: null,
      location: 'Ballroom',
      photoURL: 'https://example.test/g.jpg',
      cancelled: false,
      myRsvp: null,
      address: '200 Sample Ave',
      feeCents: 2500,
      rsvpDeadline: null,
      host: null,
      going: { count: 0, preview: [] },
    } satisfies EventDetail;
    expect(formFromEvent(event)).toEqual({
      title: 'Gala',
      category: 'fundraiser',
      location: 'Ballroom',
      address: '200 Sample Ave',
      description: 'About',
      startsAt: new Date(2026, 10, 7, 19),
      endsAt: null,
      rsvpDeadline: new Date(2026, 10, 6, 19),
      fee: '25',
      photoURL: 'https://example.test/g.jpg',
    });
  });
});

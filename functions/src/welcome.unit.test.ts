import { describe, expect, it } from 'vitest';

import { welcomeCaption, welcomePostId } from './welcome';

describe('welcome post', () => {
  it('introduces the new brother with his line, work and businesses', () => {
    expect(
      welcomeCaption({
        displayName: 'Sample Reed',
        initiationTerm: 'Spring 2019',
        headline: 'Broker',
        industry: 'Real estate',
        businesses: ['Sample Realty', 'Sample Barbershop'],
      }),
    ).toBe(
      'Please welcome Brother Sample Reed to the chapter! Spring 2019 line. Works in Real estate (Broker). Owns Sample Realty and Sample Barbershop. Say hello and welcome him in.',
    );
  });

  it('leaves out whatever he skipped', () => {
    expect(welcomeCaption({ displayName: 'Sample Reed', initiationTerm: 'Fall 2021' })).toBe(
      'Please welcome Brother Sample Reed to the chapter! Fall 2021 line. Say hello and welcome him in.',
    );
    expect(welcomeCaption({ displayName: 'Sample Reed', headline: 'Teacher' })).toBe(
      'Please welcome Brother Sample Reed to the chapter! Teacher. Say hello and welcome him in.',
    );
    expect(welcomeCaption({ businesses: ['A', 'B', 'C', ' '] })).toBe(
      'Please welcome our newest brother to the chapter! Owns A, B and C. Say hello and welcome him in.',
    );
  });

  it('has one ID per brother, so he’s only welcomed once', () => {
    expect(welcomePostId('u1')).toBe('welcome-u1');
  });

  it('uses no em dashes, matching the app’s copy', () => {
    expect(welcomeCaption({ displayName: 'A', industry: 'Law', headline: 'Attorney' })).not.toMatch(
      /—/,
    );
  });
});

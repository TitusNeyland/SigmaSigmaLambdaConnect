import { anniversariesThisWeek, yearsLabel } from './anniversaryLogic';

const NOW = new Date(2026, 10, 5, 15); // Thu, Nov 5 2026, 3 PM
const brother = (uid: string, initiationDate: Date | null) => ({
  uid,
  displayName: `Sample ${uid}`,
  photoURL: null,
  initiationDate,
});

describe('anniversariesThisWeek', () => {
  it('finds anniversaries today through six days out, soonest first', () => {
    const list = anniversariesThisWeek(
      [
        brother('later', new Date(2021, 10, 11)), // Wed, 5 years
        brother('today', new Date(2016, 10, 5)), // today, 10 years
        brother('past', new Date(2020, 10, 4)), // yesterday: next year
        brother('tooFar', new Date(2019, 10, 12)), // a week out
        brother('none', null),
      ],
      NOW,
    );
    expect(list.map((a) => [a.uid, a.years, a.date.getDate()])).toEqual([
      ['today', 10, 5],
      ['later', 5, 11],
    ]);
  });

  it('skips anyone who crossed less than a year ago', () => {
    expect(anniversariesThisWeek([brother('new', new Date(2026, 10, 6))], NOW)).toEqual([]);
  });

  it('wraps into next year at the end of December', () => {
    const list = anniversariesThisWeek(
      [brother('ny', new Date(2020, 0, 2))],
      new Date(2026, 11, 30),
    );
    expect(list).toHaveLength(1);
    expect(list[0].date).toEqual(new Date(2027, 0, 2));
    expect(list[0].years).toBe(7);
  });

  it('marks a leap-day line on Feb 28 in other years', () => {
    const list = anniversariesThisWeek(
      [brother('leap', new Date(2020, 1, 29))],
      new Date(2027, 1, 26),
    );
    expect(list[0].date).toEqual(new Date(2027, 1, 28));
  });

  it('says years plainly', () => {
    expect(yearsLabel(1)).toBe('1 year');
    expect(yearsLabel(5)).toBe('5 years');
  });
});

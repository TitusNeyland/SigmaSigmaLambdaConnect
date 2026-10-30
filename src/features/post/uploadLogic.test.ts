import { overallPercent, uploadLabel } from './uploadLogic';

it('averages progress across photos', () => {
  expect(overallPercent([1, 0.5, 0], 3)).toBe(50);
  expect(overallPercent([1, 1], 2)).toBe(100);
  expect(overallPercent([2, -1], 2)).toBe(50);
  expect(overallPercent([], 0)).toBe(0);
});

it('says which photo is going up, then that it’s sharing', () => {
  expect(uploadLabel(0, 3)).toBe('Uploading 1 of 3');
  expect(uploadLabel(2, 3)).toBe('Uploading 3 of 3');
  expect(uploadLabel(3, 3)).toBe('Sharing…');
  expect(uploadLabel(0, 0)).toBe('Sharing…');
});

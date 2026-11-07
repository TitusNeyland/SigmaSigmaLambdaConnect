import { nextHidden, snapHidden } from './useCollapsingHeader';

const H = 53;

describe('nextHidden', () => {
  it('hides the header as fast as the feed scrolls down, up to its height', () => {
    expect(nextHidden(0, 100, 120, H)).toBe(20);
    expect(nextHidden(20, 120, 200, H)).toBe(H);
    expect(nextHidden(H, 200, 900, H)).toBe(H);
  });

  it('brings it straight back when scrolling up, anywhere in the feed', () => {
    expect(nextHidden(H, 900, 880, H)).toBe(H - 20);
    expect(nextHidden(H - 20, 880, 700, H)).toBe(0);
  });

  it('always shows it at the top of the feed', () => {
    expect(nextHidden(H, 30, 0, H)).toBe(0);
    expect(nextHidden(10, 5, -40, H)).toBe(0);
  });

  it('stays shown until the header is measured', () => {
    expect(nextHidden(0, 0, 300, 0)).toBe(0);
  });
});

describe('snapHidden', () => {
  it('settles a half-hidden header whichever way is closer', () => {
    expect(snapHidden(H / 2 - 1, 500, H)).toBe(0);
    expect(snapHidden(H / 2, 500, H)).toBe(H);
    expect(snapHidden(H, 500, H)).toBe(H);
  });

  it('shows it at the top of the feed', () => {
    expect(snapHidden(H, 0, H)).toBe(0);
  });
});

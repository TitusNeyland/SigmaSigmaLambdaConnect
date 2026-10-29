import { contrastRatio, luminance, parseHex, passesAA } from './contrast';
import { MIN_TOUCH, palette, type } from './tokens';

describe('contrast helpers', () => {
  it('parses hex colors', () => {
    expect(parseHex('#C5A253')).toEqual([197, 162, 83]);
    expect(parseHex('111111')).toEqual([17, 17, 17]);
    expect(() => parseHex('#FFF')).toThrow();
    expect(() => parseHex('gold')).toThrow();
  });

  it('matches known WCAG values', () => {
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(luminance('#000000')).toBeCloseTo(0, 5);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio(palette.ink, palette.bg)).toBeCloseTo(
      contrastRatio(palette.bg, palette.ink),
      10,
    );
  });
});

describe('text colors meet WCAG AA where the app uses them', () => {
  const lightBackgrounds = {
    bg: palette.bg,
    grouped: palette.grouped,
    fill: palette.fill,
  } as const;

  const textOnLight = {
    ink: palette.ink,
    secondary: palette.secondary,
    goldText: palette.goldText,
    success: palette.success,
    warning: palette.warning,
    destructive: palette.destructive,
  } as const;

  for (const [textName, text] of Object.entries(textOnLight)) {
    for (const [bgName, bg] of Object.entries(lightBackgrounds)) {
      it(`${textName} on ${bgName}`, () => {
        expect(passesAA(text, bg)).toBe(true);
      });
    }
  }

  it.each([
    ['onInk on ink (primary buttons)', palette.onInk, palette.ink],
    ['onInk on destructive (destructive buttons)', palette.onInk, palette.destructive],
    ['goldSoftText on goldSoft (badges)', palette.goldSoftText, palette.goldSoft],
    ['success on successSoft (status chips)', palette.success, palette.successSoft],
    ['warning on warningSoft (status chips)', palette.warning, palette.warningSoft],
    ['gold monogram on ink', palette.gold, palette.ink],
  ])('%s', (_label, fg, bg) => {
    expect(passesAA(fg, bg)).toBe(true);
  });

  it('gold fails as text on white, which is why goldText exists', () => {
    expect(passesAA(palette.gold, palette.bg)).toBe(false);
  });

  it('gold still works as a UI graphic next to its track (3:1 is not required for rings)', () => {
    expect(contrastRatio(palette.gold, palette.bg)).toBeGreaterThan(2);
  });
});

describe('type scale', () => {
  it('every style has a size and line height, with line height >= size', () => {
    for (const style of Object.values(type)) {
      expect(style.fontSize).toBeGreaterThan(0);
      expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
    }
  });

  it('keeps body text at 16 or larger', () => {
    expect(type.body.fontSize).toBeGreaterThanOrEqual(16);
  });

  it('uses Apple’s 44 point minimum touch target', () => {
    expect(MIN_TOUCH).toBe(44);
  });
});

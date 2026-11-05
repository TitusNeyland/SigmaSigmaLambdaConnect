import {
  centerCrop,
  clampAspect,
  clampView,
  cropFromView,
  cropRect,
  frameAspect,
  MAX_ASPECT,
  MAX_ZOOM,
  MIN_ASPECT,
  viewFromCrop,
} from './cropLogic';

const wide = { width: 1920, height: 1080 }; // 16:9
const tall = { width: 1080, height: 1920 }; // 9:16
const close = (n: number) => expect.closeTo(n, 6);

describe('frameAspect', () => {
  it('follows the first photo for Original, within Instagram’s limits', () => {
    expect(frameAspect('original', wide)).toBeCloseTo(16 / 9);
    expect(frameAspect('original', tall)).toBe(MIN_ASPECT);
    expect(frameAspect('original', { width: 3000, height: 1000 })).toBe(MAX_ASPECT);
    expect(frameAspect('original', null)).toBe(1);
  });

  it('uses the chosen shape otherwise', () => {
    expect(frameAspect('square', wide)).toBe(1);
    expect(frameAspect('portrait', wide)).toBe(0.8);
    expect(frameAspect('landscape', tall)).toBeCloseTo(16 / 9);
  });

  it('treats a missing or broken ratio as square', () => {
    expect(clampAspect(NaN)).toBe(1);
    expect(clampAspect(0)).toBe(1);
  });
});

describe('centerCrop', () => {
  it('keeps the whole photo when the frame matches its shape', () => {
    expect(centerCrop(wide, 16 / 9)).toEqual({
      x: close(0),
      y: close(0),
      width: close(1),
      height: close(1),
    });
  });

  it('keeps the middle when the shapes differ', () => {
    // A 16:9 photo in a square keeps the middle 9/16 of its width.
    const crop = centerCrop(wide, 1);
    expect(crop.width).toBeCloseTo(9 / 16);
    expect(crop.height).toBeCloseTo(1);
    expect(crop.x).toBeCloseTo((1 - 9 / 16) / 2);
    expect(crop.y).toBeCloseTo(0);
  });
});

describe('clampView', () => {
  const frame = { width: 400, height: 400 };

  it('never zooms out past filling the frame, or in past the limit', () => {
    expect(clampView({ scale: 0.3, x: 0, y: 0 }, wide, frame).scale).toBe(1);
    expect(clampView({ scale: 99, x: 0, y: 0 }, wide, frame).scale).toBe(MAX_ZOOM);
  });

  it('keeps the photo covering the frame, so there are never gaps', () => {
    // Filling a 400 square, the 16:9 photo is about 711 wide: it can move 155.5 either way.
    const v = clampView({ scale: 1, x: 999, y: 50 }, wide, frame);
    expect(v.x).toBeCloseTo((400 * (16 / 9) - 400) / 2);
    expect(v.y).toBe(0);
  });
});

describe('cropFromView and viewFromCrop', () => {
  const frame = { width: 400, height: 400 };

  it('crops what the frame shows when zoomed in and moved', () => {
    const crop = cropFromView({ scale: 2, x: 100, y: -50 }, wide, frame);
    // At 2x the photo is 1422 by 800 on screen; the frame shows 400 of each.
    expect(crop.width).toBeCloseTo(400 / 1422.2222);
    expect(crop.height).toBeCloseTo(0.5);
    expect(crop.x).toBeCloseTo((1422.2222 - 400) / 2 / 1422.2222 - 100 / 1422.2222);
    expect(crop.y).toBeCloseTo(0.25 + 50 / 800);
  });

  it('reopens a saved crop exactly where it was left', () => {
    const view = { scale: 2.5, x: -120, y: 80 };
    const again = viewFromCrop(cropFromView(view, tall, frame), tall, frame);
    expect(again.scale).toBeCloseTo(2.5);
    expect(again.x).toBeCloseTo(-120);
    expect(again.y).toBeCloseTo(80);
  });
});

describe('cropRect', () => {
  it('turns a crop into pixels inside the photo', () => {
    expect(cropRect({ x: 0.25, y: 0, width: 0.5, height: 1 }, wide)).toEqual({
      originX: 480,
      originY: 0,
      width: 960,
      height: 1080,
    });
  });

  it('never reaches past the edges, even with rounding', () => {
    expect(cropRect({ x: 0.9999, y: -0.1, width: 0.5, height: 1.2 }, wide)).toEqual({
      originX: 1919,
      originY: 0,
      width: 1,
      height: 1080,
    });
  });
});

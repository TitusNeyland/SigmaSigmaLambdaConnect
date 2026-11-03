import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// The icons, splash and store images (#53) are drawn by scripts/make-icons.py.

const root = resolve(__dirname, '..');
const config = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')).expo;

/** Width, height and whether it has an alpha channel, read from the PNG header. */
function png(path: string) {
  const b = readFileSync(resolve(root, path));
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  const colorType = b[25];
  return {
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
    alpha: colorType === 6 || colorType === 4,
  };
}

describe('app icons and splash', () => {
  it('every image app.json points at exists', () => {
    const splash = config.plugins.find(
      (p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen',
    )[1];
    const paths = [
      config.icon,
      config.web.favicon,
      splash.image,
      ...Object.entries(config.android.adaptiveIcon)
        .filter(([k]) => k.endsWith('Image'))
        .map(([, v]) => v as string),
    ];
    for (const p of paths) expect(existsSync(resolve(root, p)), p).toBe(true);
  });

  it('iOS uses the chapter icon, not a leftover Icon Composer file', () => {
    expect(config.ios.icon).toBeUndefined();
    expect(existsSync(resolve(root, 'assets/expo.icon'))).toBe(false);
  });

  it('the store icon is 1024 square with no transparency', () => {
    expect(png(config.icon)).toEqual({ width: 1024, height: 1024, alpha: false });
  });

  it('the Android layers are square and the foreground is transparent', () => {
    const fg = png(config.android.adaptiveIcon.foregroundImage);
    expect(fg).toMatchObject({ width: 512, height: 512, alpha: true });
    expect(png(config.android.adaptiveIcon.backgroundImage)).toMatchObject({
      width: 512,
      height: 512,
    });
  });

  it('the Play images are the sizes Google asks for', () => {
    expect(png('assets/store/play-feature-graphic.png')).toMatchObject({
      width: 1024,
      height: 500,
    });
    expect(png('assets/store/play-icon.png')).toEqual({ width: 512, height: 512, alpha: false });
  });
});

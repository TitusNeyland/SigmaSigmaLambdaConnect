import type { TextStyle } from 'react-native';

/**
 * Design tokens. Every color, size and text style in the app comes from here so the look
 * stays consistent and dark mode (#62) can be added by swapping one palette.
 *
 * Rule: `gold` is for fills only (rings, bars, dots, badges, icons). Gold-colored text uses
 * `goldText`, because #C5A253 on white fails WCAG contrast.
 */
export const palette = {
  ink: '#111111',
  gold: '#C5A253',
  goldText: '#8A6A1F',
  goldSoft: '#F5EDD9',
  goldSoftText: '#6B4F12',
  bg: '#FFFFFF',
  grouped: '#F2F2F7',
  fill: '#F2F2F4',
  segmentTrack: '#EEEEF0',
  secondary: '#6E6E73',
  tertiary: '#B0B0B5',
  separator: '#E5E5EA',
  hairline: '#F0F0F2',
  success: '#1F6B42',
  successSoft: '#E6F0EA',
  warning: '#9A4210',
  warningSoft: '#FBEBDD',
  destructive: '#B42318',
  onInk: '#FFFFFF',
  scrim: 'rgba(0,0,0,0.32)',
} as const;

export type ColorName = keyof typeof palette;

export const colors = {
  text: palette.ink,
  textSecondary: palette.secondary,
  textOnInk: palette.onInk,
  link: palette.goldText,
  background: palette.bg,
  backgroundGrouped: palette.grouped,
  surface: palette.bg,
  fill: palette.fill,
  separator: palette.separator,
  hairline: palette.hairline,
  accent: palette.gold,
  accentSoft: palette.goldSoft,
  primary: palette.ink,
  success: palette.success,
  warning: palette.warning,
  destructive: palette.destructive,
  scrim: palette.scrim,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 16,
  sheet: 22,
  pill: 999,
} as const;

/** Apple's minimum touch target. */
export const MIN_TOUCH = 44;

/** Type scale modeled on the iOS text styles. Uses the system font (SF Pro, Roboto). */
export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  subhead: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  sectionHeader: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const satisfies Record<string, TextStyle>;

export type TypeName = keyof typeof type;

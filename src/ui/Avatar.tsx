import { Image, StyleSheet, View } from 'react-native';

import { palette } from '@/theme';

import { AppText } from './AppText';

export type AvatarProps = {
  name: string;
  uri?: string | null;
  size?: number;
  /** Gold ring, used on a member's own profile. */
  ring?: boolean;
  testID?: string;
};

/** "Marcus Reed" -> "MR". Uses up to two words; falls back to "?". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

const TONES = ['#A89B83', '#6F665A', '#D8CBB0', '#3D3832', '#BFB49F', '#4A443D'] as const;
const DARK_TONES = new Set<string>(['#A89B83', '#6F665A', '#3D3832', '#4A443D']);

/** Picks a stable background tone from the name so the same person always looks the same. */
export function avatarTone(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = TONES[hash % TONES.length];
  return { bg, fg: DARK_TONES.has(bg) ? palette.onInk : '#2B2824' };
}

export function Avatar({ name, uri, size = 40, ring = false, testID }: AvatarProps) {
  const { bg, fg } = avatarTone(name);
  const circle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View
      style={[ring && { ...styles.ring, borderRadius: size / 2 + 4 }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      testID={testID}
    >
      {uri ? (
        <Image source={{ uri }} style={circle} />
      ) : (
        <View style={[circle, styles.center, { backgroundColor: bg }]}>
          <AppText weight="700" color={fg} style={{ fontSize: Math.round(size * 0.36) }}>
            {initials(name)}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    padding: 2,
    borderWidth: 2,
    borderColor: palette.gold,
  },
});

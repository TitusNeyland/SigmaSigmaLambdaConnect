import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { palette } from '@/theme';

import { AppText } from './AppText';

/** The chapter's ΣΣΛ monogram in a black circle, used where the chapter itself speaks. */
export function Monogram({ size = 36 }: { size?: number }) {
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Sigma Sigma Lambda"
    >
      <AppText weight="700" color={palette.onInk} style={{ fontSize: Math.round(size * 0.32) }}>
        ΣΣΛ
      </AppText>
    </View>
  );
}

/** A gold seal with a check, beside the chapter's name on official posts. */
export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityLabel="Verified chapter account"
      accessibilityRole="image"
    >
      <Path
        d="M12 1.5l2.6 2 3.2-.4 1.2 3 3 1.2-.4 3.2 2 2.6-2 2.6.4 3.2-3 1.2-1.2 3-3.2-.4-2.6 2-2.6-2-3.2.4-1.2-3-3-1.2.4-3.2-2-2.6 2-2.6-.4-3.2 3-1.2 1.2-3 3.2.4z"
        fill={palette.gold}
      />
      <Path
        d="m7.5 12.3 3 3 6-6.3"
        fill="none"
        stroke={palette.ink}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
});

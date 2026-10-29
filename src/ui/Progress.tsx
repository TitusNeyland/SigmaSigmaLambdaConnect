import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { palette, radius } from '@/theme';

/** Clamps to 0..100 and rounds. NaN and negative values become 0. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** Percent of done / total, safe when total is 0. */
export function percentOf(done: number, total: number): number {
  if (total <= 0) return 0;
  return clampPercent((done / total) * 100);
}

/** strokeDasharray for a ring: the filled length, then the full circumference. */
export function ringDash(percent: number, r: number): [number, number] {
  const circumference = 2 * Math.PI * r;
  return [(clampPercent(percent) / 100) * circumference, circumference];
}

export type ProgressRingProps = {
  percent: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export function ProgressRing({
  percent,
  size = 76,
  stroke = 9,
  showLabel = true,
  accessibilityLabel,
  testID,
}: ProgressRingProps) {
  const value = clampPercent(percent);
  const r = (size - stroke) / 2;
  const [filled, circumference] = ringDash(value, r);
  const center = size / 2;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `${value} percent`}
      accessibilityValue={{ min: 0, max: 100, now: value }}
      testID={testID}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={palette.hairline}
          strokeWidth={stroke}
          fill="none"
        />
        {value > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={palette.gold}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
        {showLabel ? (
          <SvgText
            x={center}
            y={center + size * 0.08}
            textAnchor="middle"
            fontSize={size * 0.25}
            fontWeight="700"
            fill={palette.ink}
          >
            {`${value}%`}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

export type ProgressBarProps = {
  percent: number;
  tone?: 'gold' | 'ink' | 'warning';
  height?: number;
  accessibilityLabel?: string;
  testID?: string;
};

const BAR_TONES = { gold: palette.gold, ink: palette.ink, warning: '#D9822B' } as const;

export function ProgressBar({
  percent,
  tone = 'gold',
  height = 6,
  accessibilityLabel,
  testID,
}: ProgressBarProps) {
  const value = clampPercent(percent);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `${value} percent`}
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={[styles.track, { height, borderRadius: height }]}
      testID={testID}
    >
      <View
        testID={testID ? `${testID}-fill` : undefined}
        style={[
          styles.fill,
          { width: `${value}%`, backgroundColor: BAR_TONES[tone], borderRadius: height },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: palette.hairline,
    overflow: 'hidden',
    borderRadius: radius.pill,
  },
  fill: {
    height: '100%',
  },
});

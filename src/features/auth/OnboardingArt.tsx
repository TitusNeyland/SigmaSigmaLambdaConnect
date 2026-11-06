import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors, palette, spacing } from '@/theme';
import { AppText, Monogram } from '@/ui';

/** Line icons for onboarding, drawn in ink on a soft gold disc. */
export type ArtName = 'feed' | 'events' | 'mail' | 'lock';

const STROKE = {
  stroke: palette.ink,
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  fill: 'none',
} as const;

function Glyph({ name, size }: { name: ArtName; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden>
      {name === 'feed' ? (
        <>
          <Rect x={7} y={10} width={34} height={28} rx={6} {...STROKE} />
          <Circle cx={17} cy={20} r={3.5} {...STROKE} />
          <Path d="M8 34l10-9 7 6 6-5 10 8" {...STROKE} strokeLinejoin="round" />
        </>
      ) : name === 'events' ? (
        <>
          <Rect x={8} y={11} width={32} height={29} rx={6} {...STROKE} />
          <Path d="M8 20h32M17 7v8M31 7v8" {...STROKE} />
          <Path d="M18 30l4 4 8-8" {...STROKE} strokeLinejoin="round" />
        </>
      ) : name === 'mail' ? (
        <>
          <Rect x={6} y={12} width={36} height={26} rx={5} {...STROKE} />
          <Path d="M8 15l16 12 16-12" {...STROKE} strokeLinejoin="round" />
        </>
      ) : (
        <>
          <Rect x={11} y={21} width={26} height={19} rx={5} {...STROKE} />
          <Path d="M17 21v-5a7 7 0 0 1 14 0v5M24 29v4" {...STROKE} />
        </>
      )}
    </Svg>
  );
}

/** A big illustration for an onboarding page: an icon on a soft gold disc, with a gold dot. */
export function OnboardingArt({ name, size = 132 }: { name: ArtName | 'monogram'; size?: number }) {
  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}>
      {name === 'monogram' ? (
        <Monogram size={Math.round(size * 0.62)} />
      ) : (
        <>
          <Glyph name={name} size={Math.round(size * 0.48)} />
          <View
            style={[
              styles.dot,
              { top: size * 0.14, right: size * 0.14, width: size * 0.13, height: size * 0.13 },
            ]}
          />
        </>
      )}
    </View>
  );
}

/** A gold dot that gently pulses, for a step that's under way. Still when motion is reduced. */
export function PulseDot() {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    scale.set(withRepeat(withTiming(1.35, { duration: 900 }), -1, true));
    return () => cancelAnimation(scale);
  }, [reduce, scale]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulse, pulse]} />
    </View>
  );
}

export type StepState = 'done' | 'current' | 'todo';

/** The way in after signing up: confirm the email, then an officer's approval. */
export function journey(stage: 'verify' | 'approval') {
  return [
    { title: 'Account created', state: 'done' as const },
    {
      title: 'Confirm your email',
      detail: stage === 'verify' ? 'Tap the link we sent you.' : undefined,
      state: stage === 'verify' ? ('current' as const) : ('done' as const),
    },
    {
      title: 'Officer approval',
      detail:
        stage === 'approval'
          ? 'An officer confirms you’re a brother. You’ll get in on your own once they do.'
          : undefined,
      state: stage === 'approval' ? ('current' as const) : ('todo' as const),
    },
  ];
}

function CheckIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke={palette.onInk}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Where he is on the way in: account made, email confirmed, an officer's approval. Done
 * steps get a check, the current one pulses.
 */
export function OnboardingSteps({
  steps,
  testID,
}: {
  steps: { title: string; detail?: string; state: StepState }[];
  testID?: string;
}) {
  return (
    <View style={styles.steps} testID={testID}>
      {steps.map((step, i) => (
        <View
          key={step.title}
          style={styles.step}
          accessible
          accessibilityLabel={`${step.title}, ${
            step.state === 'done' ? 'done' : step.state === 'current' ? 'in progress' : 'to do'
          }`}
          testID={testID ? `${testID}-${i + 1}` : undefined}
        >
          <View style={styles.rail}>
            {step.state === 'done' ? (
              <View style={[styles.marker, styles.markerDone]}>
                <CheckIcon />
              </View>
            ) : step.state === 'current' ? (
              <View style={[styles.marker, styles.markerCurrent]}>
                <PulseDot />
              </View>
            ) : (
              <View style={[styles.marker, styles.markerTodo]} />
            )}
            {i < steps.length - 1 ? (
              <View style={[styles.line, step.state === 'done' && styles.lineDone]} />
            ) : null}
          </View>
          <View style={styles.stepText}>
            <AppText
              variant="callout"
              weight="600"
              color={step.state === 'todo' ? colors.textSecondary : colors.text}
            >
              {step.title}
            </AppText>
            {step.detail ? (
              <AppText variant="footnote" color={colors.textSecondary}>
                {step.detail}
              </AppText>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const MARKER = 26;

const styles = StyleSheet.create({
  disc: {
    backgroundColor: palette.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', borderRadius: 999, backgroundColor: palette.gold },
  pulseWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.gold },
  steps: { gap: 0 },
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: MARKER },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDone: { backgroundColor: palette.ink },
  markerCurrent: { backgroundColor: palette.goldSoft },
  markerTodo: { borderWidth: 2, borderColor: palette.separator },
  line: { width: 2, flex: 1, minHeight: spacing.lg, backgroundColor: palette.separator },
  lineDone: { backgroundColor: palette.ink },
  stepText: { flex: 1, paddingBottom: spacing.lg, paddingTop: spacing.xxs, gap: spacing.xxs },
});

import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, palette, radius, spacing } from '@/theme';
import { AppText, Button, haptics } from '@/ui';

import { OnboardingArt, type ArtName } from './OnboardingArt';

/** The pages of the intro, swiped through before signing up. */
export const INTRO: readonly { art: ArtName | 'monogram'; title: string; body: string }[] = [
  {
    art: 'monogram',
    title: 'Sigma Sigma Lambda',
    body: 'The chapter, in your pocket. Built for the brothers of Sigma Sigma Lambda.',
  },
  {
    art: 'feed',
    title: 'Share the moments',
    body: 'Photos from every event, chapter news and line anniversaries, in one feed.',
  },
  {
    art: 'events',
    title: 'Show up for the chapter',
    body: 'RSVP to events, check in with your code and watch your service hours add up.',
  },
  {
    art: 'lock',
    title: 'Just for brothers',
    body: 'Private by default. An officer approves every account before it sees anything.',
  },
];

/**
 * The first screen, like a native app's intro: swipe through what the app is for, then
 * create an account or sign in.
 */
export function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const last = page === INTRO.length - 1;

  function settle(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (next !== page) {
      haptics.select();
      setPage(next);
    }
  }

  function goTo(next: number) {
    pager.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        {!last ? (
          <Pressable
            onPress={() => goTo(INTRO.length - 1)}
            accessibilityRole="button"
            hitSlop={spacing.md}
            testID="intro-skip"
          >
            <AppText variant="callout" weight="600" color={colors.textSecondary}>
              Skip
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={settle}
        style={styles.pager}
        testID="intro-pager"
      >
        {INTRO.map((slide, i) => (
          <View key={slide.title} style={[styles.slide, { width }]} testID={`intro-${i + 1}`}>
            <Animated.View entering={i === 0 ? FadeInDown.duration(500) : undefined}>
              <OnboardingArt name={slide.art} />
            </Animated.View>
            <Animated.View
              entering={i === 0 ? FadeInDown.delay(120).duration(500) : undefined}
              style={styles.copy}
            >
              <AppText
                variant={i === 0 ? 'largeTitle' : 'title'}
                align="center"
                accessibilityRole="header"
              >
                {slide.title}
              </AppText>
              <AppText variant="body" color={colors.textSecondary} align="center">
                {slide.body}
              </AppText>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${INTRO.length}`}>
        {INTRO.map((slide, i) => (
          <Pressable
            key={slide.title}
            onPress={() => goTo(i)}
            accessibilityRole="button"
            accessibilityLabel={`Page ${i + 1}`}
            accessibilityState={{ selected: i === page }}
            hitSlop={spacing.sm}
            testID={`intro-dot-${i + 1}`}
          >
            <View style={[styles.dot, i === page && styles.dotOn]} />
          </Pressable>
        ))}
      </View>

      <Animated.View entering={FadeInDown.delay(240).duration(500)} style={styles.actions}>
        <Button title="Create account" onPress={() => router.push('/sign-up')} fullWidth />
        <Button
          title="Sign in"
          variant="secondary"
          onPress={() => router.push('/sign-in')}
          fullWidth
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  top: {
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  pager: { flex: 1 },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingHorizontal: spacing.xxxl,
  },
  copy: { gap: spacing.md, alignItems: 'center' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: palette.separator },
  dotOn: { width: 22, backgroundColor: palette.ink },
  actions: { gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
});

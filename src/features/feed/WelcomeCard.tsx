import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useProfile } from '@/features/profile/useProfileData';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, Chevron, HeaderButton } from '@/ui';

import { checkInCodeSeen, dismissWelcome, welcomeDismissed } from './welcomeStore';

const CHECK = 22;

type Step = { key: string; title: string; done: boolean; href: Href };

function Check({ done }: { done: boolean }) {
  return (
    <View style={[styles.check, done && styles.checkDone]}>
      {done ? (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
          <Path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke={palette.onInk}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * A short welcome at the top of Home for a newly approved brother: add a photo, add your
 * initiation date, see your check-in code. Each step ticks off as it's done; the card goes
 * away once all three are, or when he closes it.
 */
export function WelcomeCard({ uid }: { uid: string }) {
  const profile = useProfile(uid, { own: true });
  const [stored, setStored] = useState<{ dismissed: boolean; codeSeen: boolean } | null>(null);

  // Re-read on focus, so coming back from Edit profile or the code ticks the step.
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let live = true;
      Promise.all([welcomeDismissed(uid), checkInCodeSeen(uid)]).then(
        ([dismissed, codeSeen]) => live && setStored({ dismissed, codeSeen }),
      );
      return () => {
        live = false;
      };
    }, [uid]),
  );

  const me = profile.state === 'ready' ? profile.data : null;
  if (!me || !stored || stored.dismissed) return null;
  const steps: Step[] = [
    { key: 'photo', title: 'Add a profile photo', done: !!me.photoURL, href: '/profile/edit' },
    {
      key: 'date',
      title: 'Add your initiation date',
      done: !!me.initiationDate,
      href: '/profile/edit',
    },
    {
      key: 'code',
      title: 'See your check-in code',
      done: stored.codeSeen,
      href: '/profile/check-in-code',
    },
  ];
  const left = steps.filter((s) => !s.done).length;
  if (left === 0) return null;

  function close() {
    setStored((s) => (s ? { ...s, dismissed: true } : s));
    void dismissWelcome(uid);
  }

  return (
    <View style={styles.card} testID="welcome">
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="headline" accessibilityRole="header">
            Welcome to the chapter app
          </AppText>
          <AppText variant="footnote" color={colors.textSecondary}>
            {left === 1 ? 'One thing left to set up.' : `${left} quick things to set up.`}
          </AppText>
        </View>
        <HeaderButton title="Close" onPress={close} testID="welcome-close" />
      </View>
      {steps.map((step) => (
        <Pressable
          key={step.key}
          onPress={() => router.push(step.href, { withAnchor: true })}
          accessibilityRole="button"
          accessibilityLabel={`${step.title}${step.done ? ', done' : ''}`}
          style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          testID={`welcome-${step.key}`}
        >
          <Check done={step.done} />
          <AppText style={styles.flex} color={step.done ? colors.textSecondary : colors.text}>
            {step.title}
          </AppText>
          <Chevron />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: spacing.lg,
    marginBottom: 0,
    padding: spacing.lg,
    gap: spacing.xs,
    borderRadius: radius.xl,
    backgroundColor: colors.backgroundGrouped,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1 },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
  pressed: { opacity: 0.7 },
  check: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    borderWidth: spacing.xxs,
    borderColor: colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: palette.success, borderColor: palette.success },
});

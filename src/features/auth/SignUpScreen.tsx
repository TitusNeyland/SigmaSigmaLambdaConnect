import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { signUp } from '@/data/auth';
import { createPendingProfile } from '@/data/members';
import { uploadAvatar } from '@/data/profile';
import { LIMITS } from '@/data/types';
import { addBusiness } from '@/features/profile/aboutYou';
import { BusinessList, IndustryPicker, InterestPicker } from '@/features/profile/AboutYouFields';
import { pickAvatar } from '@/features/profile/pickAvatar';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, Avatar, Button, haptics, SegmentedControl, TextField } from '@/ui';

import { useAuth } from './AuthProvider';
import { forgetSignUp, rememberSignUp } from './pendingSignUp';
import { signOutHere } from './signOut';
import { SignUpSummary } from './SignUpSummary';

import {
  EMPTY_DRAFT,
  FINISH_STEPS,
  OPTIONAL_STEPS,
  passwordChecks,
  SEASONS,
  SIGN_UP_STEPS,
  stepError,
  termOf,
  toSignUpInput,
  type Season,
  type SignUpDraft,
  type SignUpStep,
} from './signUpSteps';
import { friendlyAuthError, hasErrors, validateSignUp } from './validation';

/** What each step asks, in the member's words. */
const COPY: Record<SignUpStep, { title: string; body: string; button: string }> = {
  name: {
    title: 'What’s your name?',
    body: 'This is how brothers will see you in the chapter.',
    button: 'Continue',
  },
  initiated: {
    title: 'When did you cross?',
    body: 'Officers use your line to confirm you’re a brother of the chapter.',
    button: 'Continue',
  },
  work: {
    title: 'What do you do?',
    body: 'Brothers look for each other by line of work. Pick yours and add your title.',
    button: 'Continue',
  },
  business: {
    title: 'Own a business?',
    body: 'The chapter loves to support brother-owned businesses. Add up to 3.',
    button: 'Continue',
  },
  interests: {
    title: 'What are you into?',
    body: 'Pick a few. It helps brothers find common ground.',
    button: 'Continue',
  },
  email: {
    title: 'What’s your email?',
    body: 'You’ll sign in with it, and we’ll send a link to confirm it’s yours.',
    button: 'Continue',
  },
  photo: {
    title: 'Add a profile photo',
    body: 'Help brothers put a face to your name. You can change it anytime.',
    button: 'Continue',
  },
  password: {
    title: 'Create a password',
    body: 'Make it one you don’t use anywhere else.',
    button: 'Continue',
  },
  review: {
    title: 'Review your information',
    body: 'Make sure it all looks right. Officers see this when they approve you. Tap anything to change it.',
    button: 'Create account',
  },
};

function BackIcon() {
  return (
    <Svg width={12} height={20} viewBox="0 0 12 20" fill="none" accessibilityElementsHidden>
      <Path
        d="M10 2 2 10l8 8"
        stroke={colors.text}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RuleIcon({ met }: { met: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden>
      {met ? (
        <>
          <Circle cx={12} cy={12} r={11} fill={palette.success} />
          <Path
            d="M7 12.5l3.2 3.2L17 9"
            stroke={palette.onInk}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      ) : (
        <Circle cx={12} cy={12} r={10} stroke={palette.tertiary} strokeWidth={2} fill="none" />
      )}
    </Svg>
  );
}

/**
 * Creating an account, one question per screen: a progress bar along the top, a big
 * question, one field that's ready to type in, and Continue just above the keyboard.
 *
 * With mode "finish", it's for an account that already exists but has no profile (sign up
 * was cut off before the profile saved): the same questions without email and password,
 * ending in a review that sends the request.
 */
export function SignUpScreen({ mode = 'signUp' }: { mode?: 'signUp' | 'finish' }) {
  const router = useRouter();
  const auth = useAuth();
  const finishing = mode === 'finish';
  const steps = finishing ? FINISH_STEPS : SIGN_UP_STEPS;
  const REVIEW = steps.indexOf('review');
  const [draft, setDraft] = useState<SignUpDraft>(() =>
    finishing ? { ...EMPTY_DRAFT, displayName: auth.user?.displayName ?? '' } : EMPTY_DRAFT,
  );
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now] = useState(() => new Date());
  // A business name typed but not added yet; Continue adds it.
  const [businessDraft, setBusinessDraft] = useState('');
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  // Changing an answer from the review goes straight back to it.
  const [fromReview, setFromReview] = useState(false);
  const step = steps[index];
  const copy =
    finishing && step === 'name'
      ? {
          ...COPY.name,
          body: 'Your account is set up. Answer a few questions to send your request.',
        }
      : finishing && step === 'review'
        ? { ...COPY.review, button: 'Send request' }
        : COPY[step];
  // The photo step has its own Skip for now button.
  const optional = OPTIONAL_STEPS.includes(step) && step !== 'photo';

  async function choosePhoto() {
    setPhotoNote(null);
    const picked = await pickAvatar().catch(() => null);
    if (!picked) return setPhotoNote('Couldn’t open your photos. Try again.');
    if (picked.status === 'denied') {
      return setPhotoNote('Allow photo access in Settings to add a photo, or skip for now.');
    }
    if (picked.status === 'picked') {
      haptics.select();
      set('photoUri')(picked.uri);
    }
  }

  const set =
    <K extends keyof SignUpDraft>(key: K) =>
    (value: SignUpDraft[K]) => {
      setDraft((d) => ({ ...d, [key]: value }));
      setError(null);
      setFormError(null);
    };

  function back() {
    setError(null);
    setFormError(null);
    if (fromReview) {
      setFromReview(false);
      setIndex(REVIEW);
    } else if (index > 0) setIndex(index - 1);
    else if (finishing) return;
    else if (router.canGoBack()) router.back();
    else router.replace('/welcome');
  }

  function skip() {
    setError(null);
    haptics.select();
    setIndex(index + 1);
  }

  async function next() {
    if (step === 'business' && businessDraft.trim()) {
      const added = addBusiness(draft.businesses, businessDraft);
      if ('businesses' in added) set('businesses')(added.businesses);
      setBusinessDraft('');
    }
    const problem = stepError(step, draft, now, steps);
    if (problem) {
      setError(problem);
      return;
    }
    if (fromReview && step !== 'review') {
      setFromReview(false);
      setIndex(REVIEW);
      return;
    }
    if (index < steps.length - 1) {
      haptics.select();
      setIndex(index + 1);
      return;
    }
    if (finishing) return sendRequest();
    const input = toSignUpInput(draft);
    if (hasErrors(validateSignUp(input))) return;
    setSubmitting(true);
    // Kept in case the account is made but saving the profile fails: Finish your profile
    // then shows these for review instead of asking again.
    rememberSignUp(input);
    try {
      await signUp(input);
      forgetSignUp();
      haptics.success();
    } catch (e) {
      setFormError(friendlyAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  /** Finish mode: save the profile for the account that's already there. */
  async function sendRequest() {
    const user = auth.user;
    if (!user) return;
    const input = toSignUpInput({ ...draft, email: user.email ?? '' });
    setSubmitting(true);
    try {
      await createPendingProfile(user.uid, {
        displayName: input.displayName,
        initiationTerm: input.initiationTerm,
        email: user.email,
        about: input.about,
      });
      if (input.photoUri) await uploadAvatar(user.uid, input.photoUri).catch(() => {});
      haptics.success();
    } catch (e) {
      setFormError(friendlyAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  const field = {
    error: error ?? undefined,
    returnKeyType: 'next' as const,
    onSubmitEditing: () => void next(),
    autoFocus: true,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.top}>
          {finishing && index === 0 && !fromReview ? (
            <View style={styles.back} />
          ) : (
            <Pressable
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={spacing.sm}
              style={styles.back}
              testID="sign-up-back"
            >
              <BackIcon />
            </Pressable>
          )}
          <View
            style={styles.progress}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${index + 1} of ${steps.length}`}
            accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }}
            testID="sign-up-progress"
          >
            {steps.map((s, i) => (
              <View key={s} style={[styles.segment, i <= index && styles.segmentOn]} />
            ))}
          </View>
          {optional ? (
            <Pressable
              onPress={skip}
              accessibilityRole="button"
              hitSlop={spacing.sm}
              style={styles.back}
              testID="sign-up-skip"
            >
              <AppText variant="callout" weight="600" color={colors.textSecondary}>
                Skip
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View key={step} entering={FadeInRight.duration(260)} style={styles.step}>
            <View style={styles.heading}>
              <AppText variant="title" accessibilityRole="header">
                {copy.title}
              </AppText>
              <AppText variant="callout" color={colors.textSecondary}>
                {copy.body}
              </AppText>
            </View>

            {step === 'name' ? (
              <TextField
                label="Full name"
                placeholder="First and last name"
                value={draft.displayName}
                onChangeText={set('displayName')}
                autoComplete="name"
                textContentType="name"
                autoCapitalize="words"
                testID="sign-up-name"
                {...field}
              />
            ) : step === 'initiated' ? (
              <View style={styles.term}>
                <SegmentedControl<Season>
                  segments={SEASONS.map((s) => ({ value: s, label: s }))}
                  value={draft.season}
                  onChange={(s) => {
                    haptics.select();
                    set('season')(s);
                  }}
                  accessibilityLabel="Season you crossed"
                  testID="sign-up-season"
                />
                <TextField
                  label="Year"
                  placeholder={String(now.getFullYear() - 5)}
                  value={draft.year}
                  onChangeText={(v) => set('year')(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  maxLength={4}
                  testID="sign-up-year"
                  {...field}
                  autoFocus={false}
                />
              </View>
            ) : step === 'work' ? (
              <View style={styles.term}>
                <IndustryPicker value={draft.industry} onChange={set('industry')} />
                <TextField
                  label="Job title"
                  hint="Optional"
                  placeholder="Like Project manager"
                  value={draft.headline}
                  onChangeText={set('headline')}
                  maxLength={LIMITS.headline}
                  autoCapitalize="words"
                  testID="sign-up-headline"
                  {...field}
                  autoFocus={false}
                />
              </View>
            ) : step === 'business' ? (
              <BusinessList
                value={draft.businesses}
                onChange={set('businesses')}
                draft={businessDraft}
                onDraftChange={setBusinessDraft}
              />
            ) : step === 'interests' ? (
              <InterestPicker value={draft.interests} onChange={set('interests')} />
            ) : step === 'photo' ? (
              <View style={styles.photo}>
                <Avatar
                  name={draft.displayName || 'New brother'}
                  uri={draft.photoUri}
                  size={132}
                  ring
                  testID="sign-up-avatar"
                />
                <Button
                  title={draft.photoUri ? 'Choose a different photo' : 'Choose a photo'}
                  variant="secondary"
                  onPress={() => void choosePhoto()}
                  fullWidth
                  testID="sign-up-choose-photo"
                />
                {draft.photoUri ? (
                  <Button
                    title="Remove photo"
                    variant="plain"
                    onPress={() => set('photoUri')(null)}
                    testID="sign-up-remove-photo"
                  />
                ) : null}
                {photoNote ? (
                  <AppText
                    variant="footnote"
                    color={colors.textSecondary}
                    align="center"
                    testID="sign-up-photo-note"
                  >
                    {photoNote}
                  </AppText>
                ) : null}
              </View>
            ) : step === 'review' ? (
              <SignUpSummary
                info={{
                  displayName: draft.displayName.trim(),
                  initiationTerm: termOf(draft.season, draft.year),
                  headline: draft.headline,
                  industry: draft.industry,
                  businesses: draft.businesses,
                  interests: draft.interests,
                  photoUri: draft.photoUri,
                  email: finishing ? (auth.user?.email ?? '') : draft.email.trim(),
                }}
                lockEmail={finishing}
                onEdit={(section) => {
                  setFromReview(true);
                  setIndex(steps.indexOf(section));
                }}
              />
            ) : step === 'email' ? (
              <TextField
                label="Email"
                placeholder="you@example.com"
                value={draft.email}
                onChangeText={set('email')}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                testID="sign-up-email"
                {...field}
              />
            ) : (
              <View style={styles.term}>
                <TextField
                  label="Password"
                  value={draft.password}
                  onChangeText={set('password')}
                  secure
                  autoComplete="new-password"
                  textContentType="newPassword"
                  testID="sign-up-password"
                  {...field}
                />
                <View style={styles.rules} testID="sign-up-rules">
                  {passwordChecks(draft.password).map((rule) => (
                    <View
                      key={rule.label}
                      style={styles.rule}
                      accessible
                      accessibilityLabel={`${rule.label}, ${rule.met ? 'done' : 'not yet'}`}
                    >
                      <RuleIcon met={rule.met} />
                      <AppText
                        variant="subhead"
                        color={rule.met ? colors.text : colors.textSecondary}
                      >
                        {rule.label}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {formError ? (
              <View style={styles.formError} accessibilityRole="alert">
                <AppText variant="subhead" color={colors.destructive}>
                  {formError}
                </AppText>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={
              fromReview && step !== 'review'
                ? 'Done'
                : step === 'photo' && !draft.photoUri
                  ? 'Skip for now'
                  : copy.button
            }
            onPress={() => void next()}
            loading={submitting}
            fullWidth
            testID={step === 'review' ? 'sign-up-submit' : 'sign-up-next'}
          />
          {finishing && index === 0 ? (
            <Button title="Sign out" variant="plain" onPress={() => signOutHere()} />
          ) : index === 0 ? (
            <Link href="/sign-in" replace style={styles.link}>
              <AppText variant="callout" color={colors.textSecondary}>
                Have an account?{' '}
                <AppText variant="callout" color={colors.link}>
                  Sign in
                </AppText>
              </AppText>
            </Link>
          ) : (
            <AppText variant="footnote" color={colors.textSecondary} align="center">
              An officer approves every account before it sees chapter content.
            </AppText>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
  },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  progress: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: palette.separator },
  segmentOn: { backgroundColor: palette.gold },
  content: { padding: spacing.xl, paddingTop: spacing.xxl },
  step: { gap: spacing.xxl },
  heading: { gap: spacing.sm },
  term: { gap: spacing.lg },
  photo: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.md },
  rules: { gap: spacing.sm },
  rule: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  formError: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: palette.warningSoft },
  footer: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  link: { paddingVertical: spacing.sm },
});

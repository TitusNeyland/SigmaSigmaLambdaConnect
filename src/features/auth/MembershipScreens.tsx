import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SUPPORT_EMAIL } from '@/config/app';
import { signOutHere } from './signOut';
import { createPendingProfile } from '@/data/members';
import { uploadAvatar } from '@/data/profile';
import { colors, palette, radius, spacing } from '@/theme';
import { AppText, Button, ListRow, ListSection } from '@/ui';

import { useAuth } from './AuthProvider';
import { journey, OnboardingArt, OnboardingSteps } from './OnboardingArt';
import { forgetSignUp, recallSignUp, type PendingSignUp } from './pendingSignUp';
import { useSession } from './session';
import { SignUpScreen } from './SignUpScreen';
import { SignUpSummary } from './SignUpSummary';
import { friendlyAuthError } from './validation';

function StatusLayout({
  symbol,
  tone,
  title,
  body,
  children,
}: {
  symbol: string;
  tone: 'gold' | 'neutral';
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={[styles.icon, tone === 'gold' ? styles.iconGold : styles.iconNeutral]}>
          <AppText variant="title2" color={tone === 'gold' ? palette.goldText : palette.ink}>
            {symbol}
          </AppText>
        </View>
        <AppText variant="title" align="center" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="callout" color={colors.textSecondary} align="center">
          {body}
        </AppText>
      </View>
      <View style={styles.actions}>{children}</View>
    </SafeAreaView>
  );
}

/**
 * Shown until an officer approves the account, with how far along he is. Moves on by
 * itself when they approve.
 */
export function PendingScreen() {
  const { member } = useSession();
  const first = member?.displayName.trim().split(/\s+/)[0];
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pending}>
        <View style={styles.pendingHero}>
          <OnboardingArt name="monogram" size={112} />
          <AppText variant="title" align="center" accessibilityRole="header">
            Waiting for approval
          </AppText>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            {first ? `You’re almost in, ${first}. ` : 'You’re almost in. '}
            Keep the app handy: this screen opens the chapter as soon as you’re approved.
          </AppText>
        </View>
        <View style={styles.card}>
          <OnboardingSteps steps={journey('approval')} testID="pending-steps" />
        </View>
        <ListSection header="Your request">
          <ListRow title="Name" value={member?.displayName ?? ''} />
          <ListRow title="Initiated" value={member?.initiationTerm ?? ''} />
        </ListSection>
      </ScrollView>
      <Button title="Sign out" variant="plain" onPress={() => signOutHere()} />
    </SafeAreaView>
  );
}

export function DeclinedScreen() {
  return (
    <StatusLayout
      symbol="!"
      tone="neutral"
      title="Request not approved"
      body="An officer couldn't confirm this account. If you think that's a mistake, reach out to the chapter."
    >
      <Button
        title="Contact the chapter"
        variant="secondary"
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        fullWidth
      />
      <Button title="Sign out" variant="plain" onPress={() => signOutHere()} />
    </StatusLayout>
  );
}

export function ConnectionErrorScreen() {
  const { retry } = useSession();
  return (
    <StatusLayout
      symbol="?"
      tone="neutral"
      title="Can’t reach the chapter"
      body="Check your connection and try again."
    >
      <Button title="Try again" onPress={retry} fullWidth testID="session-retry" />
      <Button title="Sign out" variant="plain" onPress={() => signOutHere()} />
    </StatusLayout>
  );
}

/**
 * The account was made but the profile wasn't saved, say the connection dropped. When this
 * phone still has his sign up answers, he just reviews and sends them; otherwise he answers
 * the sign up questions (no email or password; the account has those) and sends them.
 */
export function CompleteProfileScreen() {
  const auth = useAuth();
  const [saved] = useState(() => recallSignUp(auth.user?.email));
  return saved ? <ReviewSignUp saved={saved} /> : <SignUpScreen mode="finish" />;
}

/** His sign up answers, ready to send again with one tap. */
function ReviewSignUp({ saved }: { saved: PendingSignUp }) {
  const auth = useAuth();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!auth.user) return;
    setSending(true);
    setError(null);
    try {
      await createPendingProfile(auth.user.uid, {
        displayName: saved.displayName,
        initiationTerm: saved.initiationTerm,
        email: auth.user.email,
        about: saved.about,
      });
      if (saved.photoUri) await uploadAvatar(auth.user.uid, saved.photoUri).catch(() => {});
      forgetSignUp();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.review}>
        <View style={styles.reviewHead}>
          <AppText variant="title" accessibilityRole="header">
            Review your information
          </AppText>
          <AppText variant="callout" color={colors.textSecondary}>
            Your account is set up. Send this to the chapter so an officer can approve you.
          </AppText>
        </View>
        <SignUpSummary
          info={{
            displayName: saved.displayName,
            initiationTerm: saved.initiationTerm,
            headline: saved.about?.headline ?? '',
            industry: saved.about?.industry ?? '',
            businesses: saved.about?.businesses ?? [],
            interests: saved.about?.interests ?? [],
            photoUri: saved.photoUri ?? null,
            email: auth.user?.email ?? saved.email,
          }}
        />
        {error ? (
          <AppText variant="subhead" color={colors.destructive} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
      </ScrollView>
      <View style={styles.actions}>
        <Button
          title="Send request"
          onPress={() => void send()}
          loading={sending}
          fullWidth
          testID="profile-submit"
        />
        <Button title="Sign out" variant="plain" onPress={() => signOutHere()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped, padding: spacing.xl },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGold: { backgroundColor: palette.goldSoft },
  iconNeutral: { backgroundColor: palette.fill },
  actions: { gap: spacing.md },
  pending: { flexGrow: 1, justifyContent: 'center', gap: spacing.xl },
  review: { gap: spacing.xl, paddingBottom: spacing.xl },
  reviewHead: { gap: spacing.sm },
  pendingHero: { alignItems: 'center', gap: spacing.md },
  card: {
    padding: spacing.lg,
    paddingBottom: 0,
    borderRadius: radius.xl,
    backgroundColor: palette.bg,
  },
});

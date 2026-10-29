import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SUPPORT_EMAIL } from '@/config/app';
import { signOutHere } from './signOut';
import { createPendingProfile } from '@/data/members';
import { colors, palette, spacing } from '@/theme';
import { AppText, Button, ListRow, ListSection, TextField } from '@/ui';

import { AuthForm } from './AuthForm';
import { useAuth } from './AuthProvider';
import { useSession } from './session';
import { friendlyAuthError, hasErrors, validateProfile } from './validation';

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

/** Shown until an officer approves the account. Moves on by itself when they do. */
export function PendingScreen() {
  const { member } = useSession();
  return (
    <StatusLayout
      symbol="…"
      tone="gold"
      title="Waiting for approval"
      body="An officer will confirm you're a member of the chapter. You'll get in automatically once they approve you."
    >
      <ListSection header="Your request">
        <ListRow title="Name" value={member?.displayName ?? ''} />
        <ListRow title="Initiated" value={member?.initiationTerm ?? ''} />
      </ListSection>
      <Button title="Sign out" variant="plain" onPress={() => signOutHere()} />
    </StatusLayout>
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

/** For accounts whose sign up was interrupted before the profile was saved. */
export function CompleteProfileScreen() {
  const auth = useAuth();
  const [displayName, setDisplayName] = useState(auth.user?.displayName ?? '');
  const [initiationTerm, setInitiationTerm] = useState('');
  const [errors, setErrors] = useState<{ displayName?: string; initiationTerm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!auth.user) return;
    const next = validateProfile({ displayName, initiationTerm });
    setErrors(next);
    setFormError(null);
    if (hasErrors(next)) return;
    setSaving(true);
    try {
      await createPendingProfile(auth.user.uid, {
        displayName,
        initiationTerm,
        email: auth.user.email,
      });
    } catch (error) {
      setFormError(friendlyAuthError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthForm
      title="Finish your profile"
      subtitle="Officers use this to confirm you're a member."
      formError={formError}
      footer={
        <View style={styles.actions}>
          <Button
            title="Send request"
            onPress={submit}
            loading={saving}
            fullWidth
            testID="profile-submit"
          />
          <Button title="Sign out" variant="plain" onPress={() => signOutHere()} />
        </View>
      }
    >
      <TextField
        label="Full name"
        value={displayName}
        onChangeText={setDisplayName}
        error={errors.displayName}
        testID="profile-name"
      />
      <TextField
        label="Initiated"
        hint="Like Spring 2019"
        value={initiationTerm}
        onChangeText={setInitiationTerm}
        error={errors.initiationTerm}
        testID="profile-term"
      />
    </AuthForm>
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
});

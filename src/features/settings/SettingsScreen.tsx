import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COMMUNITY_GUIDELINES_URL, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/config/app';
import { AccountDeletionError, deleteAccount, type DeleteAccountError } from '@/data/account';
import { sendPasswordReset, signOut } from '@/data/auth';
import { subscribeToBlocked } from '@/data/blocks';
import { setNotificationPref } from '@/data/profile';
import type { NotificationPrefs } from '@/data/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSession } from '@/features/auth/session';
import { useProfile } from '@/features/profile/useProfileData';
import { colors, spacing } from '@/theme';
import {
  AppText,
  BottomSheet,
  Button,
  ListRow,
  ListSection,
  NavHeader,
  StatusChip,
  SwitchRow,
  TextField,
} from '@/ui';

const NOTIFICATIONS: { key: keyof NotificationPrefs; title: string; subtitle: string }[] = [
  {
    key: 'events',
    title: 'Event reminders',
    subtitle: 'New events and reminders before ones you RSVP to',
  },
  { key: 'announcements', title: 'Announcements', subtitle: 'Posts from chapter officers' },
  { key: 'social', title: 'Likes and comments', subtitle: 'When brothers react to your posts' },
  { key: 'tasks', title: 'Program tasks', subtitle: 'Milestones and deadlines you’re assigned' },
];

export function goBackToProfile() {
  if (router.canGoBack()) router.back();
  else router.replace('/profile');
}

/** Header used by Settings and its sub-screens. */
export function SettingsHeader({ title }: { title: string }) {
  return <NavHeader title={title} onBack={goBackToProfile} backTestID="settings-back" />;
}

function open(url: string) {
  Linking.openURL(url).catch(() => {});
}

const DELETE_ERRORS: Record<DeleteAccountError, string> = {
  'wrong-password': 'That password isn’t right.',
  'too-many-attempts': 'Too many tries. Wait a few minutes and try again.',
  offline: 'You’re offline. Connect and try again.',
  failed: 'Couldn’t delete your account. Try again, or contact the chapter.',
};

function useBlockedCount(uid: string): number | null {
  const [result, setResult] = useState<{ uid: string; count: number | null } | null>(null);
  useEffect(() => {
    if (!uid) return;
    return subscribeToBlocked(
      uid,
      (accounts) => setResult({ uid, count: accounts.length }),
      () => setResult({ uid, count: null }),
    );
  }, [uid]);
  return result && result.uid === uid ? result.count : null;
}

export function SettingsScreen() {
  const auth = useAuth();
  const session = useSession();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const email = auth.status === 'signedIn' ? (auth.user.email ?? '') : '';
  const profile = useProfile(uid, { own: true });
  const blockedCount = useBlockedCount(uid);

  // Switches flip right away and roll back if the save fails.
  const [pending, setPending] = useState<Partial<NotificationPrefs>>({});
  const [prefsError, setPrefsError] = useState(false);
  const stored = profile.state === 'ready' && profile.data ? profile.data.notificationPrefs : null;

  const [sheet, setSheet] = useState<null | 'signOut' | 'password' | 'delete'>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [signingOut, setSigningOut] = useState(false);

  async function togglePref(key: keyof NotificationPrefs, value: boolean) {
    setPrefsError(false);
    setPending((p) => ({ ...p, [key]: value }));
    try {
      await setNotificationPref(uid, key, value);
    } catch {
      setPrefsError(true);
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  }

  async function sendReset() {
    setResetState('sending');
    try {
      await sendPasswordReset(email);
      setResetState('sent');
    } catch {
      setResetState('failed');
    }
  }

  async function confirmSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setSheet(null);
    }
  }

  function openDelete() {
    setDeletePassword('');
    setDeleteError(null);
    setSheet('delete');
  }

  async function confirmDelete() {
    if (!deletePassword) {
      setDeleteError('Enter your password to confirm.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      // On success the session ends and the app returns to Welcome on its own.
      await deleteAccount(deletePassword);
    } catch (error) {
      setDeleteError(
        DELETE_ERRORS[error instanceof AccountDeletionError ? error.reason : 'failed'],
      );
      setDeleting(false);
    }
  }

  const approved = session.status === 'approved';
  const version = Constants.expoConfig?.version ?? '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content}>
        <ListSection header="Account">
          <ListRow title="Email" value={email} testID="row-email" />
          <ListRow
            title="Password"
            value="Send reset link"
            onPress={() => {
              setResetState('idle');
              setSheet('password');
            }}
            showChevron
            testID="row-password"
          />
          <ListRow
            title="Membership"
            trailing={
              <StatusChip
                label={approved ? 'Approved' : 'Pending'}
                tone={approved ? 'success' : 'gold'}
                testID="membership-chip"
              />
            }
            testID="row-membership"
          />
        </ListSection>

        <ListSection
          header="Notifications"
          footer={
            prefsError
              ? 'Couldn’t save that change. Check your connection and try again.'
              : undefined
          }
        >
          {NOTIFICATIONS.map(({ key, title, subtitle }) => (
            <SwitchRow
              key={key}
              title={title}
              subtitle={subtitle}
              value={pending[key] ?? stored?.[key] ?? false}
              disabled={!stored || key in pending}
              onValueChange={(v) => togglePref(key, v)}
              testID={`pref-${key}`}
            />
          ))}
        </ListSection>

        <ListSection header="Privacy">
          <ListRow title="Who sees my profile" value="Chapter members" testID="row-visibility" />
          <ListRow
            title="Blocked accounts"
            value={blockedCount === null ? '' : String(blockedCount)}
            onPress={() => router.push('/profile/blocked')}
            showChevron
            testID="row-blocked"
          />
        </ListSection>

        <ListSection header="Help">
          <ListRow
            title="Community guidelines"
            onPress={() => open(COMMUNITY_GUIDELINES_URL)}
            showChevron
            testID="row-guidelines"
          />
          <ListRow
            title="Report a problem or abuse"
            subtitle={SUPPORT_EMAIL}
            onPress={() => open(`mailto:${SUPPORT_EMAIL}`)}
            showChevron
            testID="row-support"
          />
          <ListRow
            title="Terms of service"
            onPress={() => open(TERMS_URL)}
            showChevron
            testID="row-terms"
          />
          <ListRow
            title="Privacy policy"
            onPress={() => open(PRIVACY_URL)}
            showChevron
            testID="row-privacy"
          />
        </ListSection>

        <ListSection>
          <ListRow title="Sign out" onPress={() => setSheet('signOut')} testID="row-sign-out" />
          <ListRow
            title="Delete account"
            destructive
            onPress={openDelete}
            testID="row-delete-account"
          />
        </ListSection>

        {version ? (
          <AppText variant="caption" color={colors.textSecondary} align="center">
            {`Version ${version}`}
          </AppText>
        ) : null}
      </ScrollView>

      <BottomSheet visible={sheet === 'signOut'} onClose={() => setSheet(null)} title="Sign out?">
        <AppText variant="callout" color={colors.textSecondary} align="center">
          You’ll need to sign in again to see the chapter.
        </AppText>
        <Button
          title="Sign out"
          onPress={confirmSignOut}
          loading={signingOut}
          fullWidth
          testID="confirm-sign-out"
        />
        <Button title="Cancel" variant="plain" onPress={() => setSheet(null)} fullWidth />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'delete'}
        onClose={() => !deleting && setSheet(null)}
        title="Delete your account?"
      >
        <AppText variant="callout" color={colors.textSecondary} align="center">
          This permanently removes your profile, photos, posts, comments, likes and RSVPs.
          Attendance the chapter needs for its records is kept without your name. This can’t be
          undone.
        </AppText>
        <TextField
          label="Password"
          value={deletePassword}
          onChangeText={(v) => {
            setDeletePassword(v);
            setDeleteError(null);
          }}
          secure
          autoComplete="current-password"
          error={deleteError ?? undefined}
          testID="delete-password"
        />
        <Button
          title="Delete account"
          variant="destructive"
          onPress={confirmDelete}
          loading={deleting}
          fullWidth
          testID="confirm-delete"
        />
        <Button
          title="Cancel"
          variant="plain"
          onPress={() => setSheet(null)}
          disabled={deleting}
          fullWidth
        />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'password'}
        onClose={() => setSheet(null)}
        title="Change password"
      >
        <AppText variant="callout" color={colors.textSecondary} align="center">
          {resetState === 'sent'
            ? `Check ${email} for a link to set a new password.`
            : resetState === 'failed'
              ? 'Couldn’t send the email. Try again in a minute.'
              : `We’ll email a link to ${email} so you can set a new password.`}
        </AppText>
        {resetState === 'sent' ? (
          <Button title="Done" onPress={() => setSheet(null)} fullWidth testID="reset-done" />
        ) : (
          <>
            <Button
              title="Send link"
              onPress={sendReset}
              loading={resetState === 'sending'}
              fullWidth
              testID="send-reset"
            />
            <Button title="Cancel" variant="plain" onPress={() => setSheet(null)} fullWidth />
          </>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
});

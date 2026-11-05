import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchRecipients, saveRecipients } from '@/data/committeeReports';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCan } from '@/features/roles/RoleProvider';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { AppText, HeaderButton, TextField } from '@/ui';

import { MAX_RECIPIENTS, parseEmails } from './reportLogic';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter/documents');
}

/** Admins set who committee reports are emailed to: the chapter's VPs. */
export function RecipientsScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const allowed = useCan('committeeReports.recipients');
  const [text, setText] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    fetchRecipients().then(
      (emails) => {
        if (!live) return;
        setText(emails.join('\n'));
        setState('ready');
      },
      () => live && setState('error'),
    );
    return () => {
      live = false;
    };
  }, [allowed]);

  const { emails, invalid } = parseEmails(text);
  const tooMany = emails.length > MAX_RECIPIENTS;
  const error = invalid.length
    ? `Not an email address: ${invalid.join(', ')}`
    : tooMany
      ? `Up to ${MAX_RECIPIENTS} addresses.`
      : undefined;
  const canSave = allowed && state === 'ready' && !error && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await saveRecipients(uid, emails);
      close();
    } catch {
      setSaveFailed(true);
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HeaderButton title="Cancel" onPress={close} testID="recipients-cancel" />
        <AppText variant="headline" accessibilityRole="header">
          Report recipients
        </AppText>
        <HeaderButton
          title={saving ? 'Saving…' : 'Save'}
          bold
          disabled={!canSave}
          onPress={save}
          testID="recipients-save"
        />
      </View>
      {!allowed ? (
        <View style={styles.center}>
          <AppText
            variant="callout"
            color={colors.textSecondary}
            align="center"
            testID="recipients-denied"
          >
            Only admins can change who gets committee reports.
          </AppText>
        </View>
      ) : state !== 'ready' ? (
        <View style={styles.center}>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            {state === 'loading' ? 'Loading…' : 'Couldn’t load the recipients.'}
          </AppText>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <TextField
              label="Email addresses"
              placeholder={'vp@example.com\nsecond.vp@example.com'}
              value={text}
              onChangeText={setText}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              error={error}
              hint={`One per line, up to ${MAX_RECIPIENTS}.`}
              testID="recipients-emails"
            />
            <AppText variant="footnote" color={colors.textSecondary}>
              Every committee report is emailed to these addresses, with its file. Only admins see
              this list.
            </AppText>
            {saveFailed ? (
              <AppText
                variant="footnote"
                color={colors.destructive}
                align="center"
                testID="recipients-error"
              >
                Couldn’t save. Check your connection and try again.
              </AppText>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
    backgroundColor: colors.background,
  },
  content: { padding: spacing.lg, gap: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});

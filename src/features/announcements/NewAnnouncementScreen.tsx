import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { postAnnouncement } from '@/data/announcements';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCan, useRole } from '@/features/roles/RoleProvider';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { AppText, HeaderButton, ListSection, SwitchRow, TextField } from '@/ui';

import { canPost, MAX_BODY, MAX_TITLE } from './announcementLogic';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter');
}

/** Officers write an announcement. Every member gets a push (#43). */
export function NewAnnouncementScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const canAnnounce = useCan('announcements.post');
  const { label } = useRole();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function post() {
    if (!canPost(title, body) || sending) return;
    setSending(true);
    setFailed(false);
    try {
      await postAnnouncement(uid, { title, body, pinned, authorTitle: label });
      close();
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HeaderButton title="Cancel" onPress={close} testID="announce-cancel" />
        <AppText variant="headline" accessibilityRole="header">
          New announcement
        </AppText>
        <HeaderButton
          title={sending ? 'Posting…' : 'Post'}
          bold
          disabled={!canAnnounce || !canPost(title, body) || sending}
          onPress={post}
          testID="announce-post"
        />
      </View>
      {canAnnounce ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <TextField
              label="Title"
              value={title}
              onChangeText={setTitle}
              maxLength={MAX_TITLE}
              testID="announce-title"
            />
            <TextField
              label="Message"
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={MAX_BODY}
              hint={`${body.length}/${MAX_BODY}`}
              testID="announce-body"
            />
            <ListSection footer="Every brother gets a notification unless they turned announcements off in Settings.">
              <SwitchRow
                title="Pin to the top"
                value={pinned}
                onValueChange={setPinned}
                testID="announce-pinned"
              />
            </ListSection>
            {failed ? (
              <AppText
                variant="footnote"
                color={colors.destructive}
                align="center"
                testID="announce-error"
              >
                Couldn’t post it. Check your connection and try again.
              </AppText>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.center}>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Only chapter officers can post announcements.
          </AppText>
        </View>
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
  content: { padding: spacing.lg, gap: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});

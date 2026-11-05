import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  newReportId,
  submitReport,
  uploadReportFile,
  type LocalFile,
} from '@/data/committeeReports';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { AppText, Button, HeaderButton, ListRow, ListSection, TextField } from '@/ui';

import {
  canSubmit,
  FILE_TYPES,
  fileProblem,
  fileSize,
  fileType,
  MAX_COMMITTEE,
  MAX_PERIOD,
  MAX_SUMMARY,
} from './reportLogic';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter/documents');
}

/** Opens the phone's file picker. Null if they cancel. */
async function pickFile(): Promise<LocalFile | null> {
  // Loaded when needed: the picker is native, and an app build without it should still
  // open this screen and send reports without a file. (A require, not import(), so it
  // throws here, inside attach's try, and Jest can load it.)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const picker = require('expo-document-picker') as typeof import('expo-document-picker');
  const result = await picker.getDocumentAsync({
    type: FILE_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: fileType(asset.name, asset.mimeType),
    size: asset.size ?? 0,
  };
}

/** Any approved member submits a committee report, with an optional file. */
export function NewReportScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const [committee, setCommittee] = useState('');
  const [period, setPeriod] = useState('');
  const [summary, setSummary] = useState('');
  const [file, setFile] = useState<LocalFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const report = { committee, period, summary };
  const ready = canSubmit(report) && !sending;

  async function attach() {
    setFileError(null);
    try {
      const picked = await pickFile();
      if (!picked) return;
      const problem = fileProblem(picked);
      if (problem) setFileError(problem);
      else setFile(picked);
    } catch {
      setFileError('Attaching files needs the latest version of the app.');
    }
  }

  async function submit() {
    if (!ready) return;
    setSending(true);
    setFailed(false);
    try {
      const id = newReportId();
      const attachment = file ? await uploadReportFile(uid, id, file, (f) => setProgress(f)) : null;
      await submitReport(uid, id, report, attachment);
      close();
    } catch {
      setFailed(true);
      setSending(false);
      setProgress(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HeaderButton title="Cancel" onPress={close} disabled={sending} testID="report-cancel" />
        <AppText variant="headline" accessibilityRole="header">
          Committee report
        </AppText>
        <HeaderButton
          title={sending ? 'Sending…' : 'Send'}
          bold
          disabled={!ready}
          onPress={submit}
          testID="report-send"
        />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextField
            label="Committee"
            placeholder="Service"
            value={committee}
            onChangeText={setCommittee}
            maxLength={MAX_COMMITTEE}
            autoCapitalize="words"
            testID="report-committee"
          />
          <TextField
            label="Reporting period"
            placeholder="October 2026"
            value={period}
            onChangeText={setPeriod}
            maxLength={MAX_PERIOD}
            testID="report-period"
          />
          <TextField
            label="Summary"
            placeholder="What the committee did, what’s next, and anything you need."
            value={summary}
            onChangeText={setSummary}
            multiline
            maxLength={MAX_SUMMARY}
            hint={`${summary.length}/${MAX_SUMMARY}`}
            testID="report-summary"
          />

          <ListSection
            header="File"
            footer={fileError ?? 'Optional. A PDF, Word file or photo, up to 10 MB.'}
          >
            {file ? (
              <ListRow
                title={file.name}
                subtitle={file.size ? fileSize(file.size) : undefined}
                trailing={
                  <Button
                    title="Remove"
                    variant="plain"
                    size="small"
                    onPress={() => setFile(null)}
                    disabled={sending}
                    accessibilityLabel={`Remove ${file.name}`}
                    testID="report-file-remove"
                  />
                }
                testID="report-file"
              />
            ) : (
              <ListRow title="Attach a file" onPress={attach} testID="report-attach" />
            )}
          </ListSection>

          <AppText variant="footnote" color={colors.textSecondary} align="center">
            {progress !== null && progress < 1
              ? `Uploading the file… ${Math.round(progress * 100)}%`
              : 'Sending emails it to the chapter’s VPs. Officers can also read it in the app.'}
          </AppText>
          {failed ? (
            <AppText
              variant="footnote"
              color={colors.destructive}
              align="center"
              testID="report-error"
            >
              Couldn’t send it. Check your connection and try again.
            </AppText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
});

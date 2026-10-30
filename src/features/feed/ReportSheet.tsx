import { useState } from 'react';

import { REPORT_REASONS, type ReportReason } from '@/data/reports';
import { colors } from '@/theme';
import { AppText, BottomSheet, Button, ListRow, ListSection } from '@/ui';

import { notifyReported } from './feedEvents';

export type ReportSheetProps = {
  visible: boolean;
  /** "post" or "comment", for the wording. */
  what: 'post' | 'comment';
  onClose: () => void;
  onReport: (reason: ReportReason) => Promise<void>;
  /** Offers "Block {name}" too, for comments, which have no menu of their own. */
  block?: { name: string; onPress: () => void };
};

/**
 * Pick a reason and report. Afterwards the screen's ReportedNotice thanks the member, since
 * the reported item disappears for them. Errors keep the sheet open.
 */
export function ReportSheet({ visible, what, onClose, onReport, block }: ReportSheetProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function close() {
    if (busy) return;
    setFailed(false);
    onClose();
  }

  async function report(reason: ReportReason) {
    setBusy(true);
    setFailed(false);
    try {
      await onReport(reason);
      onClose();
      notifyReported(what);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={close} title={`Report ${what}`}>
      <AppText variant="callout" color={colors.textSecondary} align="center">
        Why are you reporting this {what}? Only chapter officers see reports.
      </AppText>
      <ListSection>
        {REPORT_REASONS.map((r) => (
          <ListRow
            key={r.value}
            title={r.label}
            onPress={busy ? undefined : () => report(r.value)}
            testID={`report-${r.value}`}
          />
        ))}
      </ListSection>
      {block ? (
        <ListSection>
          <ListRow
            title={`Block ${block.name}`}
            destructive
            onPress={busy ? undefined : block.onPress}
            testID="report-block"
          />
        </ListSection>
      ) : null}
      {failed ? (
        <AppText variant="footnote" color={colors.destructive} align="center" testID="report-error">
          Couldn’t send your report. Try again.
        </AppText>
      ) : null}
      <Button title="Cancel" variant="plain" onPress={close} disabled={busy} fullWidth />
    </BottomSheet>
  );
}

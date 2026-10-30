import { useState } from 'react';

import { colors } from '@/theme';
import { AppText, BottomSheet, Button } from '@/ui';

import { notifyBlocked } from './feedEvents';

export type BlockSheetProps = {
  visible: boolean;
  name: string;
  onClose: () => void;
  onBlock: () => Promise<void>;
};

/** Asks before blocking. The person isn't told; their posts and comments disappear. */
export function BlockSheet({ visible, name, onClose, onBlock }: BlockSheetProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function close() {
    if (busy) return;
    setFailed(false);
    onClose();
  }

  async function block() {
    setBusy(true);
    setFailed(false);
    try {
      await onBlock();
      onClose();
      notifyBlocked(name);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={close} title={`Block ${name}?`}>
      <AppText variant="callout" color={colors.textSecondary} align="center">
        They won’t be told. You won’t see their posts or comments. You can unblock them any time in
        Settings.
      </AppText>
      {failed ? (
        <AppText variant="footnote" color={colors.destructive} align="center" testID="block-error">
          Couldn’t block {name}. Try again.
        </AppText>
      ) : null}
      <Button
        title="Block"
        variant="destructive"
        onPress={block}
        loading={busy}
        fullWidth
        testID="block-confirm"
      />
      <Button title="Cancel" variant="plain" onPress={close} disabled={busy} fullWidth />
    </BottomSheet>
  );
}

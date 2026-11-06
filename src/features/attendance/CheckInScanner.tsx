import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, Button } from '@/ui';

/** The same code scanned again within this long is ignored, so one scan counts once. */
const REPEAT_MS = 2500;
const FRAME = 240;

/**
 * A full-screen camera that reads brothers' check-in codes. Each new code goes to onScan,
 * which returns what to tell the officer. It keeps scanning until they tap Done.
 */
export function CheckInScanner({
  visible,
  onScan,
  onClose,
}: {
  visible: boolean;
  onScan: (data: string) => string;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  const last = useRef<{ data: string; at: number } | null>(null);

  function scanned(data: string) {
    const now = Date.now();
    if (last.current && last.current.data === data && now - last.current.at < REPEAT_MS) return;
    last.current = { data, at: now };
    setMessage(onScan(data));
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.side} />
          <AppText variant="headline" color={colors.textOnInk} accessibilityRole="header">
            Scan check-in codes
          </AppText>
          {/* White, not the usual gold: gold text fails contrast on black. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            hitSlop={spacing.sm}
            style={styles.side}
            testID="scanner-done"
          >
            <AppText weight="600" color={colors.textOnInk} align="right">
              Done
            </AppText>
          </Pressable>
        </View>

        {permission?.granted ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(r) => scanned(r.data)}
              testID="scanner-camera"
            />
            <View style={styles.frame} pointerEvents="none" />
          </View>
        ) : (
          <View style={styles.center}>
            <AppText color={colors.textOnInk} align="center">
              {permission && !permission.canAskAgain
                ? 'Allow camera access in Settings to scan check-in codes.'
                : 'Scanning needs the camera.'}
            </AppText>
            <Button
              title={permission && !permission.canAskAgain ? 'Open Settings' : 'Allow camera'}
              variant="secondary"
              onPress={() =>
                permission && !permission.canAskAgain
                  ? void Linking.openSettings()
                  : void requestPermission()
              }
              testID="scanner-allow"
            />
          </View>
        )}

        <View style={styles.footer}>
          <AppText
            color={colors.textOnInk}
            align="center"
            accessibilityLiveRegion="polite"
            testID="scanner-message"
          >
            {message ?? 'Point the camera at a brother’s code on his Profile.'}
          </AppText>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
  },
  // Balances Done on the right, so the title stays centered.
  side: { width: MIN_TOUCH + spacing.lg, minHeight: MIN_TOUCH, justifyContent: 'center' },
  cameraWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: FRAME,
    height: FRAME,
    borderWidth: spacing.xxs,
    borderColor: palette.onInk,
    borderRadius: radius.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  footer: { padding: spacing.xl, minHeight: MIN_TOUCH * 2, justifyContent: 'center' },
});

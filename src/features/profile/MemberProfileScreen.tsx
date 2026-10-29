import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { block, subscribeToBlocked, unblock } from '@/data/blocks';
import { REPORT_REASONS, reportMember, type ReportReason } from '@/data/reports';
import { fetchRole } from '@/data/roles';
import type { RoleDoc } from '@/data/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { roleLabel } from '@/features/roles/permissions';
import { useCan } from '@/features/roles/RoleProvider';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';
import { AppText, BottomSheet, Button, ListRow, ListSection, NavHeader } from '@/ui';

import { ProfileView } from './ProfileView';
import { useProfile, useProfileExtras } from './useProfileData';

type Sheet = null | 'menu' | 'report' | 'reported' | 'block';

function MoreIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill={colors.text} accessibilityElementsHidden>
      <Circle cx={5} cy={12} r={1.8} />
      <Circle cx={12} cy={12} r={1.8} />
      <Circle cx={19} cy={12} r={1.8} />
    </Svg>
  );
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/chapter/directory');
}

function useRoleOf(uid: string): RoleDoc | null {
  const [result, setResult] = useState<{ uid: string; role: RoleDoc | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetchRole(uid).then(
      (role) => live && setResult({ uid, role }),
      // No badge is the safe fallback; the role only decorates the profile.
      () => live && setResult({ uid, role: null }),
    );
    return () => {
      live = false;
    };
  }, [uid]);
  return result && result.uid === uid ? result.role : null;
}

function useIsBlocked(me: string, other: string): boolean {
  const [blocked, setBlocked] = useState<{ key: string; value: boolean } | null>(null);
  const key = `${me}:${other}`;
  useEffect(() => {
    if (!me) return;
    return subscribeToBlocked(
      me,
      (accounts) => setBlocked({ key, value: accounts.some((a) => a.uid === other) }),
      () => {},
    );
  }, [me, other, key]);
  return blocked?.key === key ? blocked.value : false;
}

/** Another brother's profile: My profile's layout without edit controls, plus a menu. */
export function MemberProfileScreen({ uid }: { uid: string }) {
  const auth = useAuth();
  const me = auth.status === 'signedIn' ? auth.user.uid : '';
  // Attendance is private to the member and officers; the rules enforce it too.
  const canSeeAttendance = useCan('attendance.take');
  const profile = useProfile(uid);
  const extras = useProfileExtras(uid, canSeeAttendance);
  const role = useRoleOf(uid);
  const blocked = useIsBlocked(me, uid);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (uid === me) return <Redirect href="/profile" />;

  const data = profile.state === 'ready' ? profile.data : null;
  const name = data?.displayName ?? 'this brother';

  function openSheet(next: Sheet) {
    setFailed(null);
    setSheet(next);
  }

  async function run(action: () => Promise<void>, onDone: Sheet, error: string) {
    setBusy(true);
    setFailed(null);
    try {
      await action();
      setSheet(onDone);
    } catch {
      setFailed(error);
    } finally {
      setBusy(false);
    }
  }

  const report = (reason: ReportReason) =>
    run(() => reportMember(me, uid, reason), 'reported', 'Couldn’t send your report. Try again.');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader
        onBack={goBack}
        backTestID="member-back"
        trailing={
          data ? (
            <Pressable
              onPress={() => openSheet('menu')}
              accessibilityRole="button"
              accessibilityLabel="More"
              hitSlop={spacing.sm}
              style={styles.iconButton}
              testID="member-menu"
            >
              <MoreIcon />
            </Pressable>
          ) : undefined
        }
      />

      {data ? (
        <>
          {blocked ? (
            <View style={styles.banner} testID="blocked-banner">
              <AppText variant="footnote" color={colors.textSecondary} align="center">
                You blocked {data.displayName}. They aren’t told.
              </AppText>
            </View>
          ) : null}
          <ProfileView
            profile={data}
            roleLabel={role ? roleLabel(role) : null}
            stats={extras.stats}
            posts={extras.posts}
            activity={extras.activity}
            onRefresh={extras.reload}
            actions={
              data.email || data.phone ? (
                <>
                  {data.email ? (
                    <Button
                      title="Email"
                      variant="secondary"
                      size="small"
                      onPress={() => Linking.openURL(`mailto:${data.email}`).catch(() => {})}
                      accessibilityLabel={`Email ${data.displayName}`}
                      style={styles.flex}
                      testID="contact-email"
                    />
                  ) : null}
                  {data.phone ? (
                    <Button
                      title="Call"
                      variant="secondary"
                      size="small"
                      onPress={() =>
                        Linking.openURL(`tel:${data.phone.replace(/[^\d+]/g, '')}`).catch(() => {})
                      }
                      accessibilityLabel={`Call ${data.displayName}`}
                      style={styles.flex}
                      testID="contact-phone"
                    />
                  ) : null}
                </>
              ) : undefined
            }
          />
        </>
      ) : (
        <View style={styles.center}>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            {profile.state === 'loading'
              ? 'Loading…'
              : profile.state === 'error'
                ? 'Couldn’t load this profile.'
                : 'This profile isn’t available.'}
          </AppText>
        </View>
      )}

      <BottomSheet visible={sheet === 'menu'} onClose={() => setSheet(null)}>
        <ListSection>
          <ListRow
            title={`Report ${name}`}
            onPress={() => openSheet('report')}
            showChevron={false}
            testID="menu-report"
          />
          {blocked ? (
            <ListRow
              title={`Unblock ${name}`}
              onPress={() =>
                run(() => unblock(me, uid), null, `Couldn’t unblock ${name}. Try again.`)
              }
              showChevron={false}
              testID="menu-unblock"
            />
          ) : (
            <ListRow
              title={`Block ${name}`}
              destructive
              onPress={() => openSheet('block')}
              testID="menu-block"
            />
          )}
        </ListSection>
        {failed ? (
          <AppText variant="footnote" color={colors.destructive} align="center">
            {failed}
          </AppText>
        ) : null}
        <Button title="Cancel" variant="plain" onPress={() => setSheet(null)} fullWidth />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'report'}
        onClose={() => !busy && setSheet(null)}
        title={`Report ${name}`}
      >
        <AppText variant="callout" color={colors.textSecondary} align="center">
          Only chapter officers see reports. {data?.displayName ?? 'He'} won’t know it was you.
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
        {failed ? (
          <AppText variant="footnote" color={colors.destructive} align="center">
            {failed}
          </AppText>
        ) : null}
        <Button
          title="Cancel"
          variant="plain"
          onPress={() => setSheet(null)}
          disabled={busy}
          fullWidth
        />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'reported'}
        onClose={() => setSheet(null)}
        title="Thanks for reporting"
      >
        <AppText variant="callout" color={colors.textSecondary} align="center">
          Chapter officers will take a look. You can also block {name} so you don’t see their posts.
        </AppText>
        <Button title="Done" onPress={() => setSheet(null)} fullWidth testID="report-done" />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'block'}
        onClose={() => !busy && setSheet(null)}
        title={`Block ${name}?`}
      >
        <AppText variant="callout" color={colors.textSecondary} align="center">
          They won’t be told. You can unblock them any time in Settings.
        </AppText>
        {failed ? (
          <AppText variant="footnote" color={colors.destructive} align="center">
            {failed}
          </AppText>
        ) : null}
        <Button
          title="Block"
          variant="destructive"
          loading={busy}
          onPress={() => run(() => block(me, uid), null, `Couldn’t block ${name}. Try again.`)}
          fullWidth
          testID="confirm-block"
        />
        <Button
          title="Cancel"
          variant="plain"
          onPress={() => setSheet(null)}
          disabled={busy}
          fullWidth
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
  },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});

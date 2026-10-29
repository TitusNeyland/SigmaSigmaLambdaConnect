import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { removeAvatar, updateOwnProfile, uploadAvatar, type Profile } from '@/data/profile';
import { LIMITS } from '@/data/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { hasErrors } from '@/features/auth/validation';
import { useRole } from '@/features/roles/RoleProvider';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';
import {
  AppText,
  Avatar,
  BottomSheet,
  Button,
  HeaderButton,
  ListRow,
  ListSection,
  StatusChip,
  SwitchRow,
  TextField,
} from '@/ui';

import {
  addInterest,
  formFromProfile,
  isDirty,
  MAX_INTERESTS,
  normalizeForm,
  validateEditProfile,
  type EditProfileErrors,
  type EditProfileForm,
} from './editProfileForm';
import { pickAvatar } from './pickAvatar';
import { useProfile } from './useProfileData';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/profile');
}

function EditProfileFormView({ uid, profile }: { uid: string; profile: Profile }) {
  const role = useRole();
  const [original] = useState(() => formFromProfile(profile));
  const [form, setForm] = useState<EditProfileForm>(original);
  const [errors, setErrors] = useState<EditProfileErrors>({});
  const [interestDraft, setInterestDraft] = useState('');
  const [interestError, setInterestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<'idle' | 'working' | 'denied' | 'failed'>('idle');
  const [photoURL, setPhotoURL] = useState(profile.photoURL);

  const set = <K extends keyof EditProfileForm>(key: K, value: EditProfileForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const dirty = isDirty(original, form);

  async function save() {
    const next = validateEditProfile(form);
    setErrors(next);
    setSaveError(null);
    if (hasErrors(next)) return;
    setSaving(true);
    try {
      await updateOwnProfile(uid, normalizeForm(form), { email: profile.email });
      goBack();
    } catch {
      setSaveError('Couldn’t save your profile. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  function submitInterest() {
    const result = addInterest(form.interests, interestDraft);
    if ('error' in result) {
      setInterestError(result.error);
      return;
    }
    set('interests', result.interests);
    setInterestDraft('');
    setInterestError(null);
  }

  async function choosePhoto() {
    setPhotoSheet(false);
    setPhotoStatus('working');
    try {
      const picked = await pickAvatar();
      if (picked.status === 'denied') return setPhotoStatus('denied');
      if (picked.status === 'canceled') return setPhotoStatus('idle');
      setPhotoURL(await uploadAvatar(uid, picked.uri));
      setPhotoStatus('idle');
    } catch {
      setPhotoStatus('failed');
    }
  }

  async function clearPhoto() {
    setPhotoSheet(false);
    setPhotoStatus('working');
    try {
      await removeAvatar(uid);
      setPhotoURL(null);
      setPhotoStatus('idle');
    } catch {
      setPhotoStatus('failed');
    }
  }

  const bioLength = form.bio.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <HeaderButton title="Cancel" onPress={goBack} testID="edit-cancel" />
        <AppText variant="headline" accessibilityRole="header">
          Edit profile
        </AppText>
        <HeaderButton
          title={saving ? 'Saving…' : 'Done'}
          onPress={save}
          bold
          disabled={saving || !dirty}
          testID="edit-done"
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.photo}>
            <Avatar name={form.displayName || profile.displayName} uri={photoURL} size={92} />
            <Button
              title={photoStatus === 'working' ? 'Updating photo…' : 'Change photo'}
              variant="plain"
              size="small"
              disabled={photoStatus === 'working'}
              onPress={() => setPhotoSheet(true)}
              testID="change-photo"
            />
            {photoStatus === 'denied' ? (
              <View style={styles.photoNote}>
                <AppText variant="footnote" color={colors.textSecondary} align="center">
                  Allow photo access in Settings to choose a profile photo.
                </AppText>
                <Button
                  title="Open Settings"
                  variant="plain"
                  size="small"
                  onPress={() => Linking.openSettings()}
                />
              </View>
            ) : null}
            {photoStatus === 'failed' ? (
              <AppText variant="footnote" color={colors.destructive} accessibilityRole="alert">
                Couldn’t update your photo. Try again.
              </AppText>
            ) : null}
          </View>

          {saveError ? (
            <AppText variant="footnote" color={colors.destructive} accessibilityRole="alert">
              {saveError}
            </AppText>
          ) : null}

          <View style={styles.group}>
            <TextField
              label="Name"
              value={form.displayName}
              onChangeText={(v) => set('displayName', v)}
              error={errors.displayName}
              autoComplete="name"
              testID="edit-name"
            />
            <TextField
              label="Headline"
              hint="What you do, like Software engineer"
              value={form.headline}
              onChangeText={(v) => set('headline', v)}
              error={errors.headline}
              maxLength={LIMITS.headline}
              testID="edit-headline"
            />
            <View>
              <TextField
                label="Bio"
                value={form.bio}
                onChangeText={(v) => set('bio', v)}
                error={errors.bio}
                multiline
                maxLength={LIMITS.bio}
                testID="edit-bio"
              />
              <AppText
                variant="caption"
                color={bioLength >= LIMITS.bio ? colors.warning : colors.textSecondary}
                align="right"
                accessibilityLabel={`${bioLength} of ${LIMITS.bio} characters`}
                testID="bio-count"
              >
                {`${bioLength}/${LIMITS.bio}`}
              </AppText>
            </View>
          </View>

          <ListSection
            header="Chapter details"
            footer="Roles are set by officers. Other details show only to approved members."
          >
            <ListRow title="Chapter role" value={role.label} testID="role-row" />
          </ListSection>

          <View style={styles.group}>
            <TextField
              label="Initiated"
              hint="Like Spring 2019"
              value={form.initiationTerm}
              onChangeText={(v) => set('initiationTerm', v)}
              error={errors.initiationTerm}
              testID="edit-term"
            />

            <View style={styles.interests}>
              <AppText variant="footnote" weight="600" color={colors.textSecondary}>
                {`Interests (${form.interests.length}/${MAX_INTERESTS})`}
              </AppText>
              {form.interests.length > 0 ? (
                <View style={styles.chips}>
                  {form.interests.map((interest) => (
                    <Pressable
                      key={interest}
                      onPress={() =>
                        set(
                          'interests',
                          form.interests.filter((i) => i !== interest),
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${interest}`}
                      style={styles.chipButton}
                    >
                      <StatusChip label={`${interest}  ×`} tone="neutral" />
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={styles.addRow}>
                <View style={styles.flex}>
                  <TextField
                    label="Add an interest"
                    value={interestDraft}
                    onChangeText={(v) => {
                      setInterestDraft(v);
                      setInterestError(null);
                    }}
                    onSubmitEditing={submitInterest}
                    returnKeyType="done"
                    error={interestError ?? undefined}
                    testID="interest-input"
                  />
                </View>
                <Button
                  title="Add"
                  variant="secondary"
                  size="small"
                  onPress={submitInterest}
                  disabled={form.interests.length >= MAX_INTERESTS}
                  testID="interest-add"
                  style={styles.addButton}
                />
              </View>
            </View>
          </View>

          <View style={styles.group}>
            <TextField
              label="Phone"
              hint="Optional"
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              error={errors.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
              testID="edit-phone"
            />
          </View>

          <ListSection
            header="Contact info"
            footer="Only approved members of the chapter can see your profile."
          >
            <SwitchRow
              title="Show email"
              subtitle={profile.email || 'Visible to chapter members'}
              value={form.showEmail}
              onValueChange={(v) => set('showEmail', v)}
              testID="switch-email"
            />
            <SwitchRow
              title="Show phone number"
              subtitle={form.phone.trim() ? 'Lets brothers call or text you' : 'Add a phone first'}
              value={form.phone.trim() ? form.showPhone : false}
              onValueChange={(v) => set('showPhone', v)}
              disabled={!form.phone.trim()}
              testID="switch-phone"
            />
          </ListSection>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title="Profile photo">
        <Button title="Choose from library" onPress={choosePhoto} fullWidth testID="photo-choose" />
        {photoURL ? (
          <Button
            title="Remove photo"
            variant="destructive"
            onPress={clearPhoto}
            fullWidth
            testID="photo-remove"
          />
        ) : null}
        <Button title="Cancel" variant="plain" onPress={() => setPhotoSheet(false)} fullWidth />
      </BottomSheet>
    </SafeAreaView>
  );
}

export function EditProfileScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const profile = useProfile(uid, { own: true });

  if (profile.state !== 'ready' || !profile.data) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <AppText variant="callout" color={colors.textSecondary}>
          {profile.state === 'loading' ? 'Loading…' : 'Couldn’t load your profile.'}
        </AppText>
        <Button title="Back" variant="plain" onPress={goBack} />
      </SafeAreaView>
    );
  }
  // Keyed by uid so the form starts fresh for a different account.
  return <EditProfileFormView key={uid} uid={uid} profile={profile.data} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrouped },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: MIN_TOUCH + spacing.sm,
  },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  photo: { alignItems: 'center', gap: spacing.xs },
  photoNote: { alignItems: 'center' },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  interests: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipButton: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  addButton: { marginBottom: spacing.xxs },
});

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  cancelEvent,
  createEvent,
  newEventId,
  updateEvent,
  uploadEventPhoto,
} from '@/data/eventAdmin';
import { fetchEventDetail, type EventDetail } from '@/data/events';
import { EVENT_CATEGORIES } from '@/data/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCan } from '@/features/roles/RoleProvider';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import {
  AppText,
  BottomSheet,
  Button,
  DateTimeField,
  FilterChips,
  HeaderButton,
  ListRow,
  ListSection,
  SwitchRow,
  TextField,
} from '@/ui';

import {
  blankForm,
  formFromEvent,
  hasErrors,
  MAX_DESCRIPTION,
  moveStart,
  toEventInput,
  validateEventForm,
  type EventForm,
  type EventFormErrors,
} from './eventForm';
import { CATEGORY_LABELS } from './eventsLogic';
import { pickEventPhoto } from './pickEventPhoto';

const CATEGORY_OPTIONS = EVENT_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

function goBack(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as '/events');
}

type Loaded =
  { state: 'loading' } | { state: 'ready'; event: EventDetail | null } | { state: 'error' };

/** Create (no id) or edit an event. Officers only; the rules enforce the same. */
export function EventFormScreen({ id }: { id?: string }) {
  const canManage = useCan('events.manage');
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const [loaded, setLoaded] = useState<Loaded>(
    id ? { state: 'loading' } : { state: 'ready', event: null },
  );

  useEffect(() => {
    if (!id || !uid) return;
    let live = true;
    fetchEventDetail(id, uid).then(
      (event) => live && setLoaded({ state: 'ready', event }),
      () => live && setLoaded({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [id, uid]);

  if (!canManage) {
    return (
      <Message
        text="Only chapter officers can create and edit events."
        onBack={() => goBack('/events')}
      />
    );
  }
  if (loaded.state === 'loading')
    return <Message text="Loading…" onBack={() => goBack('/events')} />;
  if (loaded.state === 'error') {
    return <Message text="Couldn’t load this event." onBack={() => goBack('/events')} />;
  }
  if (id && !loaded.event) {
    return <Message text="This event isn’t available." onBack={() => goBack('/events')} />;
  }
  return <Form uid={uid} existing={loaded.event} />;
}

function Message({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <HeaderButton title="Close" onPress={onBack} testID="event-form-close" />
      </View>
      <View style={styles.center}>
        <AppText variant="callout" color={colors.textSecondary} align="center">
          {text}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

function Form({ uid, existing }: { uid: string; existing: EventDetail | null }) {
  const isNew = existing === null;
  const [form, setForm] = useState<EventForm>(() =>
    existing ? formFromEvent(existing) : blankForm(new Date()),
  );
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cancelSheet, setCancelSheet] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const back = () => goBack(existing ? `/events/${existing.id}` : '/events');

  async function choosePhoto() {
    setPhotoNote(null);
    const pick = await pickEventPhoto().catch(() => null);
    if (!pick) setPhotoNote('Couldn’t open your photos. Try again.');
    else if (pick.status === 'denied') {
      setPhotoNote('Allow photo access in Settings to add an event photo.');
    } else if (pick.status === 'picked') setPhotoUri(pick.uri);
  }

  function removePhoto() {
    setPhotoUri(null);
    set('photoURL', null);
  }

  async function save() {
    const next = validateEventForm(form, { now: new Date(), isNew });
    setErrors(next);
    setSaveError(null);
    if (hasErrors(next)) return;
    setSaving(true);
    try {
      const id = existing?.id ?? newEventId();
      const photoURL = photoUri ? await uploadEventPhoto(id, photoUri) : form.photoURL;
      const input = toEventInput({ ...form, photoURL });
      if (existing) await updateEvent(id, input);
      else await createEvent(id, uid, input);
      if (existing) back();
      else router.replace({ pathname: '/events/[id]', params: { id } });
    } catch {
      setSaveError('Couldn’t save the event. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmCancel() {
    if (!existing) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelEvent(existing.id);
      setCancelSheet(false);
      back();
    } catch {
      setCancelError('Couldn’t cancel the event. Try again.');
    } finally {
      setCancelling(false);
    }
  }

  const shownPhoto = photoUri ?? form.photoURL;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <HeaderButton title="Cancel" onPress={back} testID="event-form-cancel" />
        <AppText variant="headline" accessibilityRole="header">
          {isNew ? 'New event' : 'Edit event'}
        </AppText>
        <HeaderButton
          title={saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
          onPress={save}
          bold
          disabled={saving}
          testID="event-form-save"
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.photo}>
            {shownPhoto ? (
              <Image
                source={{ uri: shownPhoto }}
                style={styles.hero}
                contentFit="cover"
                accessibilityLabel="Event photo"
                testID="event-form-photo"
              />
            ) : (
              <View style={[styles.hero, styles.heroBlank]}>
                <AppText variant="title2" color={palette.goldSoftText}>
                  ΣΣΛ
                </AppText>
              </View>
            )}
            <View style={styles.photoButtons}>
              <Button
                title={shownPhoto ? 'Change photo' : 'Add photo'}
                variant="secondary"
                size="small"
                onPress={choosePhoto}
                testID="event-form-pick-photo"
              />
              {shownPhoto ? (
                <Button
                  title="Remove"
                  variant="plain"
                  size="small"
                  onPress={removePhoto}
                  testID="event-form-remove-photo"
                />
              ) : null}
            </View>
            {photoNote ? (
              <AppText variant="footnote" color={colors.textSecondary} align="center">
                {photoNote}
              </AppText>
            ) : null}
          </View>

          <View style={styles.group}>
            <TextField
              label="Title"
              value={form.title}
              onChangeText={(v) => set('title', v)}
              error={errors.title}
              testID="event-form-title"
            />
            <View style={styles.field}>
              <AppText variant="footnote" color={colors.textSecondary}>
                Category
              </AppText>
              <FilterChips
                options={CATEGORY_OPTIONS}
                value={form.category}
                onChange={(v) => set('category', v)}
                accessibilityLabel="Category"
                testID="event-form-category"
              />
            </View>
          </View>

          <View style={styles.group}>
            <DateTimeField
              label="Starts"
              value={form.startsAt}
              onChange={(d) => setForm((f) => moveStart(f, d))}
              error={errors.startsAt}
              testID="event-form-starts"
            />
            <SwitchRow
              title="End time"
              value={form.endsAt !== null}
              onValueChange={(on) =>
                set('endsAt', on ? new Date(form.startsAt.getTime() + 2 * 3600_000) : null)
              }
              testID="event-form-has-end"
            />
            {form.endsAt ? (
              <DateTimeField
                label="Ends"
                value={form.endsAt}
                onChange={(d) => set('endsAt', d)}
                error={errors.endsAt}
                testID="event-form-ends"
              />
            ) : null}
            <DateTimeField
              label="RSVP by"
              value={form.rsvpDeadline}
              onChange={(d) => set('rsvpDeadline', d)}
              error={errors.rsvpDeadline}
              testID="event-form-deadline"
            />
          </View>

          <View style={styles.group}>
            <TextField
              label="Place"
              value={form.location}
              onChangeText={(v) => set('location', v)}
              placeholder="Chapter house"
              error={errors.location}
              testID="event-form-location"
            />
            <TextField
              label="Address (optional)"
              value={form.address}
              onChangeText={(v) => set('address', v)}
              hint="Used for Directions."
              error={errors.address}
              testID="event-form-address"
            />
            <TextField
              label="Fee"
              value={form.fee}
              onChangeText={(v) => set('fee', v)}
              placeholder="Free"
              keyboardType="decimal-pad"
              hint="In dollars. Leave empty if it’s free."
              error={errors.fee}
              testID="event-form-fee"
            />
          </View>

          <View style={styles.group}>
            <TextField
              label="About"
              value={form.description}
              onChangeText={(v) => set('description', v)}
              multiline
              maxLength={MAX_DESCRIPTION}
              error={errors.description}
              testID="event-form-description"
            />
          </View>

          {saveError ? (
            <AppText
              variant="footnote"
              color={colors.destructive}
              align="center"
              testID="event-form-error"
            >
              {saveError}
            </AppText>
          ) : hasErrors(errors) ? (
            <AppText variant="footnote" color={colors.destructive} align="center">
              Fix the highlighted fields to save.
            </AppText>
          ) : null}

          {existing && !existing.cancelled ? (
            <ListSection footer="Going and Maybe RSVPs are told. The event stays listed as cancelled.">
              <ListRow
                title="Cancel event"
                destructive
                onPress={() => {
                  setCancelError(null);
                  setCancelSheet(true);
                }}
                testID="event-form-cancel-event"
              />
            </ListSection>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={cancelSheet}
        onClose={() => !cancelling && setCancelSheet(false)}
        title={`Cancel ${existing?.title ?? 'this event'}?`}
      >
        <AppText variant="callout" color={colors.textSecondary} align="center">
          Everyone who said Going or Maybe gets a notification. RSVPs close. This can’t be undone.
        </AppText>
        {cancelError ? (
          <AppText variant="footnote" color={colors.destructive} align="center">
            {cancelError}
          </AppText>
        ) : null}
        <Button
          title="Cancel event"
          variant="destructive"
          loading={cancelling}
          onPress={confirmCancel}
          fullWidth
          testID="confirm-cancel-event"
        />
        <Button
          title="Keep it"
          variant="plain"
          onPress={() => setCancelSheet(false)}
          disabled={cancelling}
          fullWidth
        />
      </BottomSheet>
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
  },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  photo: { gap: spacing.sm, alignItems: 'center' },
  hero: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg },
  heroBlank: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  photoButtons: { flexDirection: 'row', gap: spacing.sm },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  field: { gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});

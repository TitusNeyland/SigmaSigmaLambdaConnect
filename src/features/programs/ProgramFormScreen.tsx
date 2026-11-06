import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { fetchDirectory, type DirectoryEntry } from '@/data/directory';
import {
  createProgram,
  deleteProgram,
  fetchProgram,
  updateProgram,
  type ProgramSummary,
} from '@/data/programs';
import { useAuth } from '@/features/auth/AuthProvider';
import { lastNameKey } from '@/features/directory/directoryLogic';
import { useCan } from '@/features/roles/RoleProvider';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';
import {
  AppText,
  Avatar,
  BottomSheet,
  Button,
  DateTimeField,
  HeaderButton,
  ListRow,
  ListSection,
  SearchField,
  TextField,
} from '@/ui';

import {
  addMilestone,
  blankProgramForm,
  formFromProgram,
  hasProgramErrors,
  MAX_DESCRIPTION,
  MAX_MILESTONES,
  moveMilestone,
  removeMilestone,
  toProgramInput,
  validateProgramForm,
  type ProgramForm,
  type ProgramFormErrors,
} from './programForm';

function goBack(fallback: '/chapter/progress' | `/chapter/programs/${string}`) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as '/chapter/progress');
}

type Loaded =
  { state: 'loading' } | { state: 'ready'; program: ProgramSummary | null } | { state: 'error' };

/**
 * New program (no id) or Edit program. Officers only; the rules enforce it. Name it, pick the
 * brother leading it, set when it's due, and list its milestones in order.
 */
export function ProgramFormScreen({ id }: { id?: string }) {
  const canManage = useCan('programs.manage');
  const [loaded, setLoaded] = useState<Loaded>(
    id ? { state: 'loading' } : { state: 'ready', program: null },
  );

  useEffect(() => {
    if (!id) return;
    let live = true;
    fetchProgram(id).then(
      (program) => live && setLoaded({ state: 'ready', program }),
      () => live && setLoaded({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [id]);

  const close = () => goBack(id ? `/chapter/programs/${id}` : '/chapter/progress');
  if (!canManage) return <Message text="Only officers can set up programs." onClose={close} />;
  if (loaded.state === 'loading') return <Message text="Loading…" onClose={close} />;
  if (loaded.state === 'error') {
    return <Message text="Couldn’t load this program." onClose={close} />;
  }
  if (id && !loaded.program) {
    return <Message text="This program isn’t available." onClose={close} />;
  }
  return <Form existing={loaded.program} />;
}

function Message({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <HeaderButton title="Close" onPress={onClose} testID="program-form-close" />
      </View>
      <View style={styles.center}>
        <AppText variant="callout" color={colors.textSecondary} align="center">
          {text}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

function Section({
  title,
  footer,
  onLayoutY,
  children,
}: {
  title: string;
  footer?: string;
  onLayoutY: (y: number) => void;
  children: ReactNode;
}) {
  return (
    <View onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)} style={styles.section}>
      <AppText
        variant="footnote"
        weight="600"
        color={colors.textSecondary}
        accessibilityRole="header"
        style={styles.sectionTitle}
      >
        {title.toUpperCase()}
      </AppText>
      <View style={styles.group}>{children}</View>
      {footer ? (
        <AppText variant="footnote" color={colors.textSecondary} style={styles.sectionTitle}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

function ArrowIcon({ up }: { up: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
        stroke={colors.text}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RemoveIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M6 6l12 12M18 6 6 18"
        stroke={colors.destructive}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SmallButton({
  label,
  onPress,
  disabled,
  children,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.small, disabled && styles.off, pressed && styles.pressed]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

type FormPart = 'what' | 'lead' | 'due' | 'milestones';

function Form({ existing }: { existing: ProgramSummary | null }) {
  const isNew = existing === null;
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const [now] = useState(() => new Date());
  const [form, setForm] = useState<ProgramForm>(() =>
    existing ? formFromProgram(existing, now) : blankProgramForm(now),
  );
  const [errors, setErrors] = useState<ProgramFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sectionY, setSectionY] = useState<Partial<Record<FormPart, number>>>({});
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const at = (section: FormPart) => (y: number) =>
    setSectionY((all) => (all[section] === y ? all : { ...all, [section]: y }));

  const set = <K extends keyof ProgramForm>(key: K, value: ProgramForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const back = () => goBack(existing ? `/chapter/programs/${existing.id}` : '/chapter/progress');

  async function save() {
    const next = validateProgramForm(form, { now: new Date(), isNew });
    setErrors(next);
    setSaveError(null);
    if (hasProgramErrors(next)) {
      const first = (['what', 'lead', 'due', 'milestones'] as const).find((s) =>
        s === 'what'
          ? next.name || next.description
          : s === 'lead'
            ? next.ownerTitle
            : s === 'due'
              ? next.dueAt
              : next.milestones || next.milestoneRows,
      );
      const y = first ? sectionY[first] : undefined;
      if (y !== undefined) {
        scroll.current?.scrollTo({ y: Math.max(0, y - spacing.lg), animated: true });
      }
      return;
    }
    setSaving(true);
    try {
      const input = toProgramInput(form);
      if (existing) {
        await updateProgram(existing, input);
        back();
      } else {
        const id = await createProgram(input, uid);
        router.replace({ pathname: '/chapter/programs/[id]', params: { id } });
      }
    } catch {
      setSaveError('Couldn’t save the program. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!existing) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProgram(existing.id);
      setDeleteSheet(false);
      router.dismissTo('/chapter/progress');
    } catch {
      setDeleteError('Couldn’t delete the program. Try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <HeaderButton title="Cancel" onPress={back} testID="program-form-cancel" />
        <AppText variant="headline" accessibilityRole="header">
          {isNew ? 'New program' : 'Edit program'}
        </AppText>
        <HeaderButton
          title={saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
          onPress={save}
          bold
          disabled={saving}
          testID="program-form-save"
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Section title="What" onLayoutY={at('what')}>
            <TextField
              label="Name"
              value={form.name}
              onChangeText={(v) => set('name', v)}
              placeholder="Like Fall food drive"
              error={errors.name}
              testID="program-form-name"
            />
            <TextField
              label="About (optional)"
              value={form.description}
              onChangeText={(v) => set('description', v)}
              placeholder="What it’s for and what success looks like"
              multiline
              maxLength={MAX_DESCRIPTION}
              error={errors.description}
              testID="program-form-description"
            />
          </Section>

          <Section
            title="Who leads it"
            footer="The lead can check milestones off and flag the program as needing help. When a brother offers to help, the lead hears about it."
            onLayoutY={at('lead')}
          >
            <Pressable
              onPress={() => setPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`Lead, ${form.ownerId ? form.ownerName : 'officers'}`}
              style={({ pressed }) => [styles.leadRow, pressed && styles.pressed]}
              testID="program-form-lead"
            >
              {form.ownerId ? (
                <Avatar name={form.ownerName} size={36} />
              ) : (
                <View style={styles.noLead} />
              )}
              <View style={styles.flex}>
                <AppText variant="body">{form.ownerId ? form.ownerName : 'No lead yet'}</AppText>
                <AppText variant="footnote" color={colors.textSecondary}>
                  {form.ownerId ? 'Tap to change' : 'Officers handle it. Tap to pick a brother.'}
                </AppText>
              </View>
            </Pressable>
            <TextField
              label="Committee or role (optional)"
              value={form.ownerTitle}
              onChangeText={(v) => set('ownerTitle', v)}
              placeholder="Like Service committee"
              error={errors.ownerTitle}
              testID="program-form-owner-title"
            />
          </Section>

          <Section title="When" onLayoutY={at('due')}>
            <DateTimeField
              label="Due"
              mode="date"
              value={form.dueAt}
              onChange={(d) => set('dueAt', d)}
              error={errors.dueAt}
              testID="program-form-due"
            />
          </Section>

          <Section
            title="Milestones"
            footer="The steps to get it done, in order. Brothers see them as a checklist, and checking them off moves the program along. Checked-off ones stay checked when you edit."
            onLayoutY={at('milestones')}
          >
            {form.milestones.map((m, i) => (
              <View key={m.key} style={styles.milestone}>
                <View style={styles.flex}>
                  <TextField
                    label={`Milestone ${i + 1}`}
                    value={m.name}
                    onChangeText={(v) =>
                      set(
                        'milestones',
                        form.milestones.map((r) => (r.key === m.key ? { ...r, name: v } : r)),
                      )
                    }
                    placeholder={i === 0 ? 'Like Book the venue' : 'Next step'}
                    error={errors.milestoneRows?.[m.key]}
                    testID={`program-form-milestone-${i + 1}`}
                  />
                </View>
                <View style={styles.rowButtons}>
                  <SmallButton
                    label={`Move milestone ${i + 1} up`}
                    onPress={() => set('milestones', moveMilestone(form.milestones, m.key, -1))}
                    disabled={i === 0}
                    testID={`program-form-up-${i + 1}`}
                  >
                    <ArrowIcon up />
                  </SmallButton>
                  <SmallButton
                    label={`Move milestone ${i + 1} down`}
                    onPress={() => set('milestones', moveMilestone(form.milestones, m.key, 1))}
                    disabled={i === form.milestones.length - 1}
                    testID={`program-form-down-${i + 1}`}
                  >
                    <ArrowIcon up={false} />
                  </SmallButton>
                  <SmallButton
                    label={`Remove milestone ${i + 1}`}
                    onPress={() => set('milestones', removeMilestone(form.milestones, m.key))}
                    testID={`program-form-remove-${i + 1}`}
                  >
                    <RemoveIcon />
                  </SmallButton>
                </View>
              </View>
            ))}
            {errors.milestones ? (
              <AppText
                variant="footnote"
                color={colors.destructive}
                testID="program-form-milestones-error"
              >
                {errors.milestones}
              </AppText>
            ) : null}
            <Button
              title="Add milestone"
              variant="secondary"
              size="small"
              onPress={() => set('milestones', addMilestone(form.milestones))}
              disabled={form.milestones.length >= MAX_MILESTONES}
              testID="program-form-add-milestone"
            />
          </Section>

          {saveError ? (
            <AppText
              variant="footnote"
              color={colors.destructive}
              align="center"
              testID="program-form-error"
            >
              {saveError}
            </AppText>
          ) : hasProgramErrors(errors) ? (
            <AppText variant="footnote" color={colors.destructive} align="center">
              Fix the highlighted fields to save.
            </AppText>
          ) : null}

          <Button
            title={isNew ? 'Create program' : 'Save changes'}
            onPress={save}
            loading={saving}
            fullWidth
            testID="program-form-submit"
          />

          {existing ? (
            <ListSection footer="Removes it with its milestones for everyone. This can’t be undone.">
              <ListRow
                title="Delete program"
                destructive
                onPress={() => {
                  setDeleteError(null);
                  setDeleteSheet(true);
                }}
                testID="program-form-delete"
              />
            </ListSection>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <LeadPicker
        visible={picker}
        current={form.ownerId}
        onClose={() => setPicker(false)}
        onPick={(entry) => {
          setForm((f) => ({
            ...f,
            ownerId: entry ? entry.uid : null,
            ownerName: entry ? entry.displayName : '',
          }));
          setPicker(false);
        }}
      />

      <BottomSheet
        visible={deleteSheet}
        onClose={() => !deleting && setDeleteSheet(false)}
        title={`Delete ${existing?.name ?? 'this program'}?`}
      >
        <AppText variant="callout" color={colors.textSecondary} align="center">
          It disappears for everyone, with its milestones and help offers. This can’t be undone.
        </AppText>
        {deleteError ? (
          <AppText variant="footnote" color={colors.destructive} align="center">
            {deleteError}
          </AppText>
        ) : null}
        <Button
          title="Delete program"
          variant="destructive"
          loading={deleting}
          onPress={confirmDelete}
          fullWidth
          testID="confirm-delete-program"
        />
        <Button
          title="Keep it"
          variant="plain"
          onPress={() => setDeleteSheet(false)}
          disabled={deleting}
          fullWidth
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

/** Pick the brother leading the program, or no one (officers handle it). */
function LeadPicker({
  visible,
  current,
  onClose,
  onPick,
}: {
  visible: boolean;
  current: string | null;
  onClose: () => void;
  onPick: (entry: DirectoryEntry | null) => void;
}) {
  const [brothers, setBrothers] = useState<DirectoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible || brothers) return;
    let live = true;
    fetchDirectory().then(
      (list) => live && setBrothers(list),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [visible, brothers]);

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (brothers ?? [])
      .filter((b) => words.every((w) => b.displayName.toLowerCase().includes(w)))
      .sort((a, b) => lastNameKey(a.displayName).localeCompare(lastNameKey(b.displayName)));
  }, [brothers, search]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Who leads it?" testID="lead-picker">
      <SearchField
        value={search}
        onChangeText={setSearch}
        label="Search brothers"
        testID="lead-search"
      />
      <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
        <ListSection>
          <ListRow
            title="No lead yet"
            subtitle="Officers handle it"
            trailing={current === null ? <AppText color={colors.link}>✓</AppText> : undefined}
            onPress={() => onPick(null)}
            testID="lead-none"
          />
          {shown.map((b) => (
            <ListRow
              key={b.uid}
              title={b.displayName}
              subtitle={b.headline || undefined}
              leading={<Avatar name={b.displayName} uri={b.photoURL} size={32} />}
              trailing={current === b.uid ? <AppText color={colors.link}>✓</AppText> : undefined}
              onPress={() => onPick(b)}
              testID={`lead-${b.uid}`}
            />
          ))}
        </ListSection>
        {failed ? (
          <AppText variant="footnote" color={colors.textSecondary} align="center">
            Couldn’t load brothers.
          </AppText>
        ) : brothers === null ? (
          <AppText variant="footnote" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : null}
      </ScrollView>
    </BottomSheet>
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
  section: { gap: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.lg },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
  noLead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.separator,
  },
  milestone: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  rowButtons: { flexDirection: 'row', gap: spacing.xxs, paddingBottom: spacing.xxs },
  small: {
    width: MIN_TOUCH - spacing.sm,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.fill,
  },
  off: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  pickerList: { maxHeight: 380 },
});

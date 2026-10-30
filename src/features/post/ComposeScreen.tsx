import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchDirectory, type DirectoryEntry } from '@/data/directory';
import { fetchEventsBetween, type EventSummary } from '@/data/events';
import { createPost, newPostId, uploadPostPhoto } from '@/data/posts';
import { useAuth } from '@/features/auth/AuthProvider';
import { restrictionNote, useRestriction } from '@/features/moderation/useRestriction';
import { useCan } from '@/features/roles/RoleProvider';
import { formatDay } from '@/features/events/eventsLogic';
import { notifyFeedChanged } from '@/features/feed/feedEvents';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import {
  AppText,
  Avatar,
  BottomSheet,
  Button,
  HeaderButton,
  ListRow,
  ListSection,
  ProgressBar,
  SearchField,
  SwitchRow,
  TextField,
} from '@/ui';

import {
  canShare,
  MAX_CAPTION,
  MAX_TAGS,
  TAG_EVENT_FUTURE_DAYS,
  TAG_EVENT_PAST_DAYS,
  tagSummary,
  taggableBrothers,
  taggableEvents,
  toggleTag,
} from './composeLogic';
import { makeCover, usePostDraft } from './draft';
import { preparePhoto } from './preparePhoto';
import { overallPercent, uploadLabel } from './uploadLogic';

const DAY = 86_400_000;

type Sheet = null | 'event' | 'brothers';
type Loadable<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error' };

function useWhenOpen<T>(open: boolean, load: () => Promise<T>): Loadable<T> {
  const [value, setValue] = useState<Loadable<T> | null>(null);
  useEffect(() => {
    if (!open || value?.state === 'ready') return;
    let live = true;
    load().then(
      (data) => live && setValue({ state: 'ready', data }),
      () => live && setValue({ state: 'error' }),
    );
    return () => {
      live = false;
    };
    // Loads once, the first time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return value ?? { state: 'loading' };
}

/** Step 2 of posting: caption, cover, tags and comments, then share. */
export function ComposeScreen() {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const { draft, setPhotos, reset } = usePostDraft();
  const [caption, setCaption] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const canPostOfficial = useCan('posts.official');
  const [official, setOfficial] = useState(false);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [tags, setTags] = useState<DirectoryEntry[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [search, setSearch] = useState('');
  const [sharing, setSharing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState<{ done: number; fractions: number[] }>({
    done: 0,
    fractions: [],
  });
  const [posted, setPosted] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const events = useWhenOpen(sheet === 'event', () =>
    fetchEventsBetween(
      uid,
      new Date(now.getTime() - TAG_EVENT_PAST_DAYS * DAY),
      new Date(now.getTime() + TAG_EVENT_FUTURE_DAYS * DAY),
    ),
  );
  const brothers = useWhenOpen(sheet === 'brothers', fetchDirectory);

  const photos = draft.photos;
  const pausedUntil = useRestriction(uid);
  const ready = canShare(photos.length, caption) && !sharing && !pausedUntil;

  // Kept across retries: the same post ID, and photos already uploaded aren't sent again.
  const upload = useRef<{ postId: string | null; paths: Map<string, string>; next: number }>({
    postId: null,
    paths: new Map(),
    next: 0,
  });

  async function share() {
    if (!canShare(photos.length, caption) || sharing || pausedUntil) return;
    setSharing(true);
    setFailed(false);
    setProgress({
      done: 0,
      fractions: photos.map((p) => (upload.current.paths.has(p.uri) ? 1 : 0)),
    });
    try {
      const state = upload.current;
      state.postId ??= newPostId();
      const id = state.postId;
      const photoPaths: string[] = [];
      for (const [i, photo] of photos.entries()) {
        let path = state.paths.get(photo.uri);
        if (!path) {
          const prepared = await preparePhoto(photo);
          path = await uploadPostPhoto(uid, id, state.next++, prepared, (fraction) =>
            setProgress((p) => ({
              ...p,
              fractions: p.fractions.map((f, j) => (j === i ? fraction : f)),
            })),
          );
          state.paths.set(photo.uri, path);
        }
        photoPaths.push(path);
        setProgress((p) => ({
          done: i + 1,
          fractions: p.fractions.map((f, j) => (j === i ? 1 : f)),
        }));
      }
      await createPost(id, uid, {
        caption: caption.trim(),
        photoPaths,
        eventId: event?.id ?? null,
        taggedMemberIds: tags.map((t) => t.uid),
        allowComments,
        official: canPostOfficial && official,
      });
      notifyFeedChanged();
      setPosted(id);
    } catch {
      setFailed(true);
    } finally {
      setSharing(false);
    }
  }

  /** Closes the posting modal back to Home, then optionally opens something there. */
  function leave(then?: () => void) {
    reset();
    router.dismissTo('/home');
    then?.();
  }

  if (posted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.posted} testID="posted">
          <View style={styles.check}>
            <AppText variant="title" color={palette.onInk}>
              ✓
            </AppText>
          </View>
          <AppText variant="title2" align="center" accessibilityRole="header">
            Posted
          </AppText>
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Your post is up for the chapter to see.
          </AppText>
          <View style={styles.postedButtons}>
            <Button
              title="View post"
              onPress={() =>
                leave(() => router.push({ pathname: '/home/post/[id]', params: { id: posted } }))
              }
              fullWidth
              testID="posted-view"
            />
            <Button
              title="Back to feed"
              variant="secondary"
              onPress={() => leave()}
              fullWidth
              testID="posted-feed"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HeaderButton title="Back" onPress={() => router.back()} testID="compose-back" />
        <AppText variant="headline" accessibilityRole="header">
          New post
        </AppText>
        <HeaderButton
          title={sharing ? 'Sharing…' : failed ? 'Retry' : 'Share'}
          bold
          disabled={!ready}
          onPress={share}
          testID="compose-share"
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {pausedUntil ? (
            <AppText variant="footnote" color={colors.warning} testID="compose-paused">
              {restrictionNote(pausedUntil)}
            </AppText>
          ) : null}
          {photos.length > 0 ? (
            <View style={styles.field}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbs}
              >
                {photos.map((photo, i) => (
                  <Pressable
                    key={photo.uri}
                    onPress={() => setPhotos((all) => makeCover(all, photo.uri))}
                    accessibilityRole="button"
                    accessibilityLabel={i === 0 ? 'Photo 1, cover' : `Photo ${i + 1}, make cover`}
                    style={[styles.thumb, i === 0 && styles.cover]}
                    testID={`compose-photo-${i + 1}`}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    {i === 0 ? (
                      <View style={styles.coverLabel}>
                        <AppText variant="caption" weight="700" color={palette.onInk}>
                          Cover
                        </AppText>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
              <AppText variant="footnote" color={colors.textSecondary}>
                Tap a photo to make it the cover. It shows first in the feed.
              </AppText>
            </View>
          ) : null}

          <TextField
            label="Caption"
            value={caption}
            onChangeText={setCaption}
            placeholder={photos.length ? 'Write a caption…' : 'What’s happening with the chapter?'}
            multiline
            maxLength={MAX_CAPTION}
            hint={`${caption.length}/${MAX_CAPTION}`}
            testID="compose-caption"
          />

          <ListSection>
            <ListRow
              title="Tag event"
              value={event ? event.title : 'None'}
              onPress={() => setSheet('event')}
              testID="compose-tag-event"
            />
            <ListRow
              title="Tag brothers"
              value={tagSummary(tags.map((t) => t.displayName))}
              onPress={() => {
                setSearch('');
                setSheet('brothers');
              }}
              testID="compose-tag-brothers"
            />
          </ListSection>

          <ListSection footer="Only approved Sigma Sigma Lambda members can see posts.">
            <SwitchRow
              title="Allow comments"
              value={allowComments}
              onValueChange={setAllowComments}
              testID="compose-comments"
            />
            {canPostOfficial ? (
              <SwitchRow
                title="Post as Sigma Sigma Lambda"
                subtitle={
                  official
                    ? 'Shows the chapter name and a verified badge. A tagged event gets an RSVP card.'
                    : 'For official chapter news. Officers only.'
                }
                value={official}
                onValueChange={setOfficial}
                testID="compose-official"
              />
            ) : null}
          </ListSection>

          <Pressable
            onPress={() => router.push('/guidelines')}
            accessibilityRole="link"
            style={styles.link}
            testID="compose-guidelines"
          >
            <AppText variant="footnote" color={colors.link} align="center">
              Community guidelines
            </AppText>
          </Pressable>

          {sharing && photos.length > 0 ? (
            <View style={styles.progress} testID="compose-progress">
              <AppText variant="footnote" color={colors.textSecondary}>
                {uploadLabel(progress.done, photos.length)}
              </AppText>
              <ProgressBar
                percent={overallPercent(progress.fractions, photos.length)}
                accessibilityLabel={`Upload ${overallPercent(progress.fractions, photos.length)} percent done`}
                testID="compose-progress-bar"
              />
            </View>
          ) : null}

          {failed ? (
            <View style={styles.progress}>
              <AppText
                variant="footnote"
                color={colors.destructive}
                align="center"
                testID="compose-error"
              >
                Couldn’t share your post. Your caption and photos are saved here.
              </AppText>
              <Button
                title="Try again"
                variant="secondary"
                onPress={share}
                fullWidth
                testID="compose-retry"
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet visible={sheet === 'event'} onClose={() => setSheet(null)} title="Tag an event">
        {events.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : events.state === 'error' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Couldn’t load events.
          </AppText>
        ) : (
          <ScrollView style={styles.sheetList}>
            <ListSection>
              <ListRow
                title="No event"
                trailing={!event ? <AppText color={colors.link}>✓</AppText> : undefined}
                onPress={() => {
                  setEvent(null);
                  setSheet(null);
                }}
                testID="tag-event-none"
              />
              {taggableEvents(events.data, now).map((e) => (
                <ListRow
                  key={e.id}
                  title={e.title}
                  subtitle={formatDay(e.startsAt, now)}
                  trailing={
                    event?.id === e.id ? <AppText color={colors.link}>✓</AppText> : undefined
                  }
                  onPress={() => {
                    setEvent(e);
                    setSheet(null);
                  }}
                  testID={`tag-event-${e.id}`}
                />
              ))}
            </ListSection>
          </ScrollView>
        )}
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'brothers'}
        onClose={() => setSheet(null)}
        title="Tag brothers"
      >
        <SearchField
          value={search}
          onChangeText={setSearch}
          label="Search brothers"
          testID="tag-search"
        />
        {brothers.state === 'loading' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Loading…
          </AppText>
        ) : brothers.state === 'error' ? (
          <AppText variant="callout" color={colors.textSecondary} align="center">
            Couldn’t load brothers.
          </AppText>
        ) : (
          <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
            <ListSection
              footer={tags.length >= MAX_TAGS ? `You can tag up to ${MAX_TAGS}.` : undefined}
            >
              {taggableBrothers(brothers.data, uid, search).map((b) => {
                const on = tags.some((t) => t.uid === b.uid);
                return (
                  <ListRow
                    key={b.uid}
                    title={b.displayName}
                    leading={<Avatar name={b.displayName} uri={b.photoURL} size={32} />}
                    trailing={on ? <AppText color={colors.link}>✓</AppText> : undefined}
                    onPress={() => {
                      const ids = toggleTag(
                        tags.map((t) => t.uid),
                        b.uid,
                      );
                      const all = [...tags, b];
                      setTags(ids.map((id) => all.find((t) => t.uid === id)!));
                    }}
                    testID={`tag-brother-${b.uid}`}
                  />
                );
              })}
            </ListSection>
          </ScrollView>
        )}
        <Button title="Done" onPress={() => setSheet(null)} fullWidth testID="tag-done" />
      </BottomSheet>
    </SafeAreaView>
  );
}

const THUMB = MIN_TOUCH * 2;

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
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  field: { gap: spacing.sm },
  thumbs: { gap: spacing.sm },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.fill,
  },
  cover: { borderWidth: 2, borderColor: palette.ink },
  coverLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: spacing.xxs,
    alignItems: 'center',
    backgroundColor: palette.scrim,
  },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  progress: { gap: spacing.sm },
  sheetList: { maxHeight: THUMB * 4 },
  posted: { flex: 1, justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  check: {
    alignSelf: 'center',
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postedButtons: { gap: spacing.sm, marginTop: spacing.lg },
});

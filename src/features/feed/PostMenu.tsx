import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { FeedPost } from '@/data/feed';
import { deletePost, updatePost, type PostEdit } from '@/data/posts';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { AppText, BottomSheet, Button, ListRow, ListSection, SwitchRow, TextField } from '@/ui';

import { MAX_CAPTION } from '@/features/post/composeLogic';

type Sheet = null | 'menu' | 'edit' | 'delete';

function MoreIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={colors.text} accessibilityElementsHidden>
      <Circle cx={5} cy={12} r={1.7} />
      <Circle cx={12} cy={12} r={1.7} />
      <Circle cx={19} cy={12} r={1.7} />
    </Svg>
  );
}

export type PostMenuProps = {
  post: FeedPost;
  me: string;
  onEdited: (edit: PostEdit) => void;
  onDeleted: () => void;
};

/** The ••• menu on a post. Authors edit or delete; report and block come for others (#36, #37). */
export function PostMenu({ post, me, onEdited, onDeleted }: PostMenuProps) {
  const mine = post.authorId === me;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [caption, setCaption] = useState(post.caption);
  const [allowComments, setAllowComments] = useState(post.allowComments);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (!mine) return null;

  const canSave = post.photoPaths.length > 0 || caption.trim().length > 0;

  function open(next: Sheet) {
    setFailed(null);
    if (next === 'edit') {
      setCaption(post.caption);
      setAllowComments(post.allowComments);
    }
    setSheet(next);
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setFailed(null);
    try {
      const edit = { caption: caption.trim(), allowComments };
      await updatePost(post.id, edit);
      onEdited(edit);
      setSheet(null);
    } catch {
      setFailed('Couldn’t save your changes. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setFailed(null);
    try {
      await deletePost(post.id);
      setSheet(null);
      onDeleted();
    } catch {
      setFailed('Couldn’t delete the post. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={() => open('menu')}
        accessibilityRole="button"
        accessibilityLabel="Post options"
        style={styles.button}
        testID={`post-menu-${post.id}`}
      >
        <MoreIcon />
      </Pressable>

      <BottomSheet visible={sheet === 'menu'} onClose={() => setSheet(null)}>
        <ListSection>
          <ListRow
            title="Edit post"
            onPress={() => open('edit')}
            showChevron={false}
            testID="post-edit"
          />
          <ListRow
            title="Delete post"
            destructive
            onPress={() => open('delete')}
            testID="post-delete"
          />
        </ListSection>
        <Button title="Cancel" variant="plain" onPress={() => setSheet(null)} fullWidth />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'edit'}
        onClose={() => !busy && setSheet(null)}
        title="Edit post"
      >
        <TextField
          label="Caption"
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={MAX_CAPTION}
          hint={`${caption.length}/${MAX_CAPTION}`}
          error={canSave ? undefined : 'A post without photos needs a caption.'}
          testID="post-edit-caption"
        />
        <SwitchRow
          title="Allow comments"
          value={allowComments}
          onValueChange={setAllowComments}
          testID="post-edit-comments"
        />
        {failed ? (
          <AppText variant="footnote" color={colors.destructive} align="center">
            {failed}
          </AppText>
        ) : null}
        <Button
          title="Save"
          onPress={save}
          loading={busy}
          disabled={!canSave}
          fullWidth
          testID="post-edit-save"
        />
        <Button
          title="Cancel"
          variant="plain"
          onPress={() => setSheet(null)}
          disabled={busy}
          fullWidth
        />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'delete'}
        onClose={() => !busy && setSheet(null)}
        title="Delete this post?"
      >
        <AppText variant="callout" color={colors.textSecondary} align="center">
          Its photos, comments and likes go too. This can’t be undone.
        </AppText>
        {failed ? (
          <AppText variant="footnote" color={colors.destructive} align="center">
            {failed}
          </AppText>
        ) : null}
        <Button
          title="Delete"
          variant="destructive"
          onPress={remove}
          loading={busy}
          fullWidth
          testID="post-delete-confirm"
        />
        <Button
          title="Cancel"
          variant="plain"
          onPress={() => setSheet(null)}
          disabled={busy}
          fullWidth
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
});

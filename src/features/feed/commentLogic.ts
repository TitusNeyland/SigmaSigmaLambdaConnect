import type { PostComment } from '@/data/comments';
import { IMAGE_COMMENT_LABEL, PREVIEW_COMMENTS, type CommentPreview } from '@/data/types';

export type CommentRow = { comment: PostComment; isReply: boolean };

/**
 * Orders comments for display: each top-level comment, then its replies, one level deep. A
 * reply to a reply joins the thread of the comment it ultimately answers. A reply whose
 * comment was deleted shows as a top-level comment. Blocked members' comments, and comments
 * the member reported, are hidden.
 */
export function threadComments(
  comments: PostComment[],
  blocked: ReadonlySet<string> = new Set(),
  /** Comments the member reported, as hiddenKey keys. */
  hidden: ReadonlySet<string> = new Set(),
  postId = '',
): CommentRow[] {
  const visible = comments.filter(
    (c) => !blocked.has(c.authorId) && !hidden.has(`comment_${postId}_${c.id}`),
  );
  const byId = new Map(visible.map((c) => [c.id, c]));
  const rootOf = (c: PostComment): string => {
    let current = c;
    const seen = new Set<string>();
    while (current.replyToId && byId.has(current.replyToId) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.replyToId)!;
    }
    return current.id;
  };
  const replies = new Map<string, PostComment[]>();
  const roots: PostComment[] = [];
  for (const c of visible) {
    const root = rootOf(c);
    if (root === c.id) roots.push(c);
    else replies.set(root, [...(replies.get(root) ?? []), c]);
  }
  return roots.flatMap((root) => [
    { comment: root, isReply: false },
    ...(replies.get(root.id) ?? []).map((comment) => ({ comment, isReply: true })),
  ]);
}

export const MAX_COMMENT = 1000;

export function canPostComment(text: string, hasPhoto = false): boolean {
  const trimmed = text.trim();
  if (trimmed.length > MAX_COMMENT) return false;
  return trimmed.length > 0 || hasPhoto;
}

/**
 * The comments the feed previews under a post: the newest top-level ones, oldest first.
 * Matches fetchCommentPreview, so the feed looks the same live or freshly loaded.
 */
export function previewOf(comments: PostComment[]): CommentPreview[] {
  return [...comments]
    .filter((c) => !c.replyToId && (c.text.trim() || c.photoPath))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(-PREVIEW_COMMENTS)
    .map((c) => ({
      id: c.id,
      authorId: c.authorId,
      authorName: c.author?.displayName ?? 'Former member',
      text: c.text.trim() || IMAGE_COMMENT_LABEL,
    }));
}

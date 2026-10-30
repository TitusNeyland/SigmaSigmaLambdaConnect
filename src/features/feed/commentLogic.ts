import type { PostComment } from '@/data/comments';

export type CommentRow = { comment: PostComment; isReply: boolean };

/**
 * Orders comments for display: each top-level comment, then its replies, one level deep. A
 * reply to a reply joins the thread of the comment it ultimately answers. A reply whose
 * comment was deleted shows as a top-level comment. Blocked members' comments are hidden.
 */
export function threadComments(
  comments: PostComment[],
  blocked: ReadonlySet<string> = new Set(),
): CommentRow[] {
  const visible = comments.filter((c) => !blocked.has(c.authorId));
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

export function canPostComment(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_COMMENT;
}

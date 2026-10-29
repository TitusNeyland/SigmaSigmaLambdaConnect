import type { Timestamp } from 'firebase/firestore';

/**
 * Document shapes for every Firestore collection. See docs/data-model.md for who can read
 * and write each one. Keep this file, the rules and the docs in sync.
 */

export const LIMITS = {
  bio: 150,
  headline: 80,
  caption: 2200,
  comment: 1000,
  photosPerPost: 10,
  reportDetails: 500,
} as const;

export type MemberStatus = 'pending' | 'approved' | 'declined';
export type Role = 'officer' | 'admin';

/** members/{uid} */
export type Member = {
  displayName: string;
  initiationTerm: string;
  headline?: string;
  bio?: string;
  interests?: string[];
  photoURL?: string | null;
  email?: string;
  phone?: string;
  showEmail?: boolean;
  showPhone?: boolean;
  status: MemberStatus;
  guidelinesAcceptedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  /** Set by an officer when approving or declining. */
  reviewedBy?: string;
  reviewedAt?: Timestamp;
};

/** Profile fields a member may change on their own document. */
export const MEMBER_EDITABLE_FIELDS = [
  'displayName',
  'initiationTerm',
  'headline',
  'bio',
  'interests',
  'photoURL',
  'email',
  'phone',
  'showEmail',
  'showPhone',
  'guidelinesAcceptedAt',
  'updatedAt',
] as const satisfies readonly (keyof Member)[];

/** roles/{uid}. No document means a regular member. */
export type RoleDoc = {
  role: Role;
  /** Officer title, e.g. "President" or "Service Chair". */
  title?: string;
};

export type EventCategory =
  'meeting' | 'service' | 'learning' | 'brotherhood' | 'fundraiser' | 'social' | 'public';

/** events/{eventId} */
export type ChapterEvent = {
  title: string;
  category: EventCategory;
  description?: string;
  startsAt: Timestamp;
  endsAt?: Timestamp;
  location: string;
  address?: string;
  photoURL?: string | null;
  feeCents?: number;
  rsvpDeadline: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
  cancelled?: boolean;
};

export type RsvpStatus = 'going' | 'maybe' | 'not_going';

/** events/{eventId}/rsvps/{uid} */
export type Rsvp = {
  status: RsvpStatus;
  updatedAt: Timestamp;
};

/** events/{eventId}/attendance/{uid}. Written by officers only. */
export type Attendance = {
  checkedInBy: string;
  checkedInAt: Timestamp;
  serviceHours?: number;
  walkIn?: boolean;
};

/** posts/{postId} */
export type Post = {
  authorId: string;
  caption: string;
  photoPaths: string[];
  eventId?: string | null;
  taggedMemberIds?: string[];
  allowComments: boolean;
  official: boolean;
  removed: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
};

/** posts/{postId}/comments/{commentId} */
export type Comment = {
  authorId: string;
  text: string;
  createdAt: Timestamp;
};

/** posts/{postId}/likes/{uid} */
export type Like = {
  createdAt: Timestamp;
};

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';
export type ReportStatus = 'open' | 'kept' | 'removed' | 'restricted';

/** reports/{reportId} */
export type Report = {
  reporterId: string;
  targetType: 'post' | 'comment';
  postId: string;
  commentId?: string | null;
  targetAuthorId: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  createdAt: Timestamp;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
};

/** blocks/{uid}/blocked/{otherUid} */
export type Block = {
  createdAt: Timestamp;
};

export type ProgressStatus = 'not_started' | 'in_progress' | 'at_risk' | 'completed';

/** programs/{programId} */
export type Program = {
  name: string;
  description?: string;
  ownerTitle: string;
  ownerId?: string;
  dueAt: Timestamp;
  status: ProgressStatus;
  chapterYear: string;
  createdAt: Timestamp;
};

/** programs/{programId}/milestones/{milestoneId} */
export type Milestone = {
  name: string;
  order: number;
  done: boolean;
  doneAt?: Timestamp | null;
  doneBy?: string | null;
};

/** goals/{goalId}. Chapter-defined, never an official national requirement. */
export type Goal = {
  name: string;
  metric: 'participation' | 'attendance' | 'service_hours' | 'active_members' | 'custom';
  target: number;
  unit: 'percent' | 'hours' | 'count';
  chapterYear: string;
  done: boolean;
};

/** announcements/{announcementId} */
export type Announcement = {
  title: string;
  body: string;
  authorId: string;
  authorTitle?: string;
  pinned: boolean;
  createdAt: Timestamp;
};

/** kpis/{periodId}, e.g. "2026-fall". Computed by Cloud Functions (#47). */
export type KpiSnapshot = {
  period: string;
  participationRate: number;
  attendanceRate: number;
  serviceHours: number;
  activeMembers: number;
  totalMembers: number;
  goalsDone: number;
  goalsTotal: number;
  computedAt: Timestamp;
};

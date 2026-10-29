/**
 * Sample data for the dev project and the emulators. Every person, event and number here is
 * made up. Emails use example.com and phone numbers use the 555-01xx fictional range.
 */

export const SAMPLE_EMAIL_DOMAIN = 'example.com';

export type SeedMember = {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  initiationTerm: string;
  headline: string;
  bio: string;
  interests: string[];
  status: 'pending' | 'approved' | 'declined';
  guidelinesAccepted: boolean;
  role?: { role: 'officer' | 'admin'; title: string };
};

const m = (
  uid: string,
  displayName: string,
  initiationTerm: string,
  headline: string,
  phoneSuffix: string,
  extra: Partial<SeedMember> = {},
): SeedMember => ({
  uid,
  displayName,
  email: `${uid}@${SAMPLE_EMAIL_DOMAIN}`,
  phone: `555-01${phoneSuffix}`,
  initiationTerm,
  headline,
  bio: '',
  interests: [],
  status: 'approved',
  guidelinesAccepted: true,
  ...extra,
});

export const MEMBERS: SeedMember[] = [
  m('sample-andre', 'Andre Hollis', 'Spring 2023', 'Nursing student', '01', {
    role: { role: 'admin', title: 'President' },
    bio: 'Sample president account.',
  }),
  m('sample-darius', 'Darius King', 'Fall 2021', 'Civil engineer', '02', {
    role: { role: 'officer', title: 'Vice President' },
    interests: ['Mentoring'],
  }),
  m('sample-chris', 'Chris Baptiste', 'Spring 2024', 'Marketing major', '03', {
    role: { role: 'officer', title: 'Secretary' },
  }),
  m('sample-kevin', 'Kevin Walker', 'Spring 2023', 'Accounting major', '04', {
    role: { role: 'officer', title: 'Treasurer' },
    interests: ['Finance'],
  }),
  m('sample-jordan', 'Jordan Ellis', 'Fall 2020', 'Teacher', '05', {
    role: { role: 'officer', title: 'Service Chair' },
    interests: ['Education', 'Mentoring'],
  }),
  m('sample-marcus', 'Marcus Reed', 'Spring 2019', 'Software engineer', '06', {
    bio: 'Mentoring chair. Happy to review a resume.',
    interests: ['Tech', 'Career mentoring'],
  }),
  m('sample-brandon', 'Brandon Lee', 'Fall 2018', 'Financial analyst', '07', {
    interests: ['Finance', 'Mentoring'],
  }),
  m('sample-terrence', 'Terrence Moss', 'Spring 2016', 'Physical therapist', '08', {
    interests: ['Health'],
  }),
  m('sample-elijah', 'Elijah Grant', 'Fall 2025', 'Pre-law student', '09', {
    guidelinesAccepted: false,
  }),
  m('sample-isaiah', 'Isaiah Brooks', 'Spring 2025', 'Biology major', '10', {
    status: 'pending',
    guidelinesAccepted: false,
  }),
  m('sample-malik', 'Malik Turner', 'Fall 2017', 'Sales manager', '11', {
    status: 'pending',
    guidelinesAccepted: false,
  }),
];

export type SeedEvent = {
  id: string;
  title: string;
  category: 'meeting' | 'service' | 'learning' | 'brotherhood' | 'fundraiser' | 'social' | 'public';
  location: string;
  description: string;
  /** Days from the seed date. Negative means in the past. */
  startsInDays: number;
  hour: number;
  rsvpDeadlineDaysBefore: number;
  feeCents?: number;
  rsvps: Record<string, 'going' | 'maybe' | 'not_going'>;
  attendance?: Record<string, { serviceHours?: number }>;
};

export const EVENTS: SeedEvent[] = [
  {
    id: 'sample-meeting-past',
    title: 'Chapter Meeting',
    category: 'meeting',
    location: 'Library Room B',
    description: 'Sample meeting. Fall program check-ins.',
    startsInDays: -7,
    hour: 19,
    rsvpDeadlineDaysBefore: 1,
    rsvps: { 'sample-marcus': 'going', 'sample-jordan': 'going', 'sample-brandon': 'maybe' },
    attendance: { 'sample-marcus': {}, 'sample-jordan': {}, 'sample-darius': {} },
  },
  {
    id: 'sample-service-day',
    title: 'Community Service Day',
    category: 'service',
    location: 'Sample Food Bank',
    description: 'Sample event. Packing food boxes. Wear closed-toe shoes.',
    startsInDays: 9,
    hour: 9,
    rsvpDeadlineDaysBefore: 2,
    rsvps: {
      'sample-marcus': 'going',
      'sample-jordan': 'going',
      'sample-kevin': 'going',
      'sample-terrence': 'maybe',
    },
  },
  {
    id: 'sample-career-panel',
    title: 'Career Panel: Tech and Finance',
    category: 'learning',
    location: 'Student Union 210',
    description: 'Sample event. Alumni on breaking in and switching careers.',
    startsInDays: 14,
    hour: 18,
    rsvpDeadlineDaysBefore: 1,
    rsvps: { 'sample-brandon': 'going', 'sample-elijah': 'maybe' },
  },
  {
    id: 'sample-bowling',
    title: 'Brotherhood Bowling Night',
    category: 'brotherhood',
    location: 'Sample Lanes',
    description: 'Sample event. Lanes reserved.',
    startsInDays: 16,
    hour: 20,
    rsvpDeadlineDaysBefore: 1,
    feeCents: 1000,
    rsvps: {},
  },
];

export type SeedPost = {
  id: string;
  authorId: string;
  caption: string;
  photoCount: number;
  eventId?: string;
  official?: boolean;
  allowComments?: boolean;
  hoursAgo: number;
  likes: string[];
  comments: { id: string; authorId: string; text: string }[];
};

export const POSTS: SeedPost[] = [
  {
    id: 'sample-post-official',
    authorId: 'sample-andre',
    caption: 'Sample announcement post. Service day sign-ups close Friday.',
    photoCount: 0,
    eventId: 'sample-service-day',
    official: true,
    hoursAgo: 1,
    likes: ['sample-marcus', 'sample-jordan'],
    comments: [],
  },
  {
    id: 'sample-post-food-bank',
    authorId: 'sample-jordan',
    caption: 'Sample post. Great turnout this morning, 40 boxes packed.',
    photoCount: 3,
    hoursAgo: 3,
    likes: ['sample-marcus', 'sample-darius', 'sample-kevin'],
    comments: [
      { id: 'c1', authorId: 'sample-darius', text: 'Proud of this crew.' },
      { id: 'c2', authorId: 'sample-kevin', text: 'Hours logged. Thanks for organizing.' },
    ],
  },
  {
    id: 'sample-post-scholarship',
    authorId: 'sample-marcus',
    caption: 'Sample post. Scholarship night was a good one.',
    photoCount: 1,
    hoursAgo: 26,
    likes: ['sample-andre'],
    comments: [{ id: 'c1', authorId: 'sample-brandon', text: 'Congrats to the recipients.' }],
  },
];

export type SeedProgram = {
  id: string;
  name: string;
  ownerTitle: string;
  dueInDays: number;
  status: 'not_started' | 'in_progress' | 'at_risk' | 'completed';
  milestones: [string, boolean][];
};

export const PROGRAMS: SeedProgram[] = [
  {
    id: 'sample-scholarship',
    name: 'Annual Scholarship Initiative',
    ownerTitle: 'Director of Education',
    dueInDays: 180,
    status: 'in_progress',
    milestones: [
      ['Form selection committee', true],
      ['Open applications', true],
      ['Review applicants', true],
      ['Final report', false],
    ],
  },
  {
    id: 'sample-mentoring',
    name: 'Youth Mentoring Program',
    ownerTitle: 'Mentoring chair',
    dueInDays: 200,
    status: 'in_progress',
    milestones: [
      ['Recruit mentors', true],
      ['Partner school agreement', true],
      ['Kickoff session', true],
      ['Fall sessions', true],
      ['Spring sessions', false],
      ['Year-end showcase', false],
    ],
  },
  {
    id: 'sample-health-week',
    name: 'Health Awareness Week',
    ownerTitle: 'Health committee',
    dueInDays: 20,
    status: 'at_risk',
    milestones: [
      ['Secure venue', true],
      ['Confirm speakers', false],
      ['Promote on campus', false],
      ['Host the week', false],
    ],
  },
  {
    id: 'sample-retreat',
    name: 'Brotherhood Retreat',
    ownerTitle: 'Brotherhood chair',
    dueInDays: 140,
    status: 'not_started',
    milestones: [
      ['Pick dates', false],
      ['Book lodging', false],
      ['Set agenda', false],
    ],
  },
  {
    id: 'sample-orientation',
    name: 'New Member Orientation',
    ownerTitle: 'Membership chair',
    dueInDays: -30,
    status: 'completed',
    milestones: [
      ['Orientation packet', true],
      ['Welcome session', true],
      ['Mentor pairing', true],
    ],
  },
];

export const ANNOUNCEMENTS = [
  {
    id: 'sample-announcement-service',
    title: 'Service day sign-ups close Friday',
    body: 'Sample announcement. We still need brothers for the food bank shift.',
    authorId: 'sample-andre',
    authorTitle: 'President',
    pinned: true,
  },
  {
    id: 'sample-announcement-dues',
    title: 'Dues reminder',
    body: 'Sample announcement. Use the payment link the Treasurer shared.',
    authorId: 'sample-kevin',
    authorTitle: 'Treasurer',
    pinned: false,
  },
];

export const GOALS = [
  {
    id: 'sample-goal-service',
    name: 'Service hours',
    metric: 'service_hours',
    target: 600,
    unit: 'hours',
  },
  {
    id: 'sample-goal-attendance',
    name: 'Meeting attendance',
    metric: 'attendance',
    target: 75,
    unit: 'percent',
  },
  {
    id: 'sample-goal-programs',
    name: 'Programs completed',
    metric: 'custom',
    target: 5,
    unit: 'count',
  },
] as const;

export const CHAPTER_YEAR = '2026-27';

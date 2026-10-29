/**
 * The chapter's community guidelines, shown before a member's first post and from Settings
 * and the compose screen. These are chapter rules for this app, not national policy. The
 * chapter can edit the wording; keep it short and plain.
 */
export const GUIDELINES_TITLE = 'Community guidelines';

export const GUIDELINES_INTRO =
  'This app is a private space for brothers of Sigma Sigma Lambda. Keep it something we’re all proud of.';

export const GUIDELINES: readonly { title: string; body: string }[] = [
  {
    title: 'Represent the chapter well',
    body: 'Post the way you’d act at a chapter event. No hate, harassment, threats or bullying of anyone.',
  },
  {
    title: 'Keep chapter business in the chapter',
    body: 'Don’t share screenshots, member details or private chapter matters outside the app.',
  },
  {
    title: 'Respect people’s privacy',
    body: 'Only post photos of people who are fine with it. Take a post down if someone asks.',
  },
  {
    title: 'Nothing explicit or illegal',
    body: 'No nudity, sexual content, drugs, or anything that breaks the law or the university’s rules.',
  },
  {
    title: 'No spam or selling',
    body: 'No ads, chain messages or repeated posts. Fundraisers go through chapter officers.',
  },
  {
    title: 'Report, don’t argue',
    body: 'If something breaks these rules, report it. Officers review every report and can remove posts or pause posting.',
  },
];

import { accessLevelFor, can, roleLabel, type Capability } from './permissions';

const OFFICER_TOOLS: Capability[] = [
  'leadership.view',
  'members.approve',
  'events.manage',
  'attendance.take',
  'announcements.post',
  'posts.official',
  'reports.review',
  'programs.manage',
];

describe('accessLevelFor', () => {
  it('treats no role document as a regular member', () => {
    expect(accessLevelFor(null)).toBe('member');
    expect(accessLevelFor(undefined)).toBe('member');
  });

  it('uses the stored role', () => {
    expect(accessLevelFor({ role: 'officer', title: 'Treasurer' })).toBe('officer');
    expect(accessLevelFor({ role: 'admin' })).toBe('admin');
  });
});

describe('can', () => {
  it.each([...OFFICER_TOOLS, 'roles.manage' as const])('members cannot %s', (capability) => {
    expect(can('member', capability)).toBe(false);
  });

  it.each(OFFICER_TOOLS)('officers can %s', (capability) => {
    expect(can('officer', capability)).toBe(true);
  });

  it('officers cannot change roles', () => {
    expect(can('officer', 'roles.manage')).toBe(false);
  });

  it.each([...OFFICER_TOOLS, 'roles.manage' as const])('admins can %s', (capability) => {
    expect(can('admin', capability)).toBe(true);
  });
});

describe('roleLabel', () => {
  it('shows Member for regular members', () => {
    expect(roleLabel(null)).toBe('Member');
  });

  it('shows the officer title when there is one', () => {
    expect(roleLabel({ role: 'officer', title: 'Service Chair' })).toBe('Service Chair');
    expect(roleLabel({ role: 'admin', title: 'President' })).toBe('President');
  });

  it('falls back to Officer or Admin without a title', () => {
    expect(roleLabel({ role: 'officer' })).toBe('Officer');
    expect(roleLabel({ role: 'admin' })).toBe('Admin');
  });
});

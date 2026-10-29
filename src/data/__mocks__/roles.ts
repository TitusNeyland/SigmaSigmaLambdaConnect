/**
 * Test double for src/data/roles.ts. Use with `jest.mock('@/data/roles')` (on by default in
 * jest.setup.js), then set the signed-in person's role with `setMockRole`.
 */
import type { RoleDoc } from '../types';

let current: RoleDoc | null = null;
let failing = false;
const listeners = new Set<{
  onChange: (role: RoleDoc | null) => void;
  onError: (error: unknown) => void;
}>();

export function setMockRole(role: RoleDoc | null) {
  current = role;
  for (const l of listeners) l.onChange(role);
}

/** Makes the next subscription fail, like a network error. */
export function failNextRoleLoad() {
  failing = true;
}

export const subscribeToRole = jest.fn(
  (_uid: string, onChange: (role: RoleDoc | null) => void, onError: (error: unknown) => void) => {
    const entry = { onChange, onError };
    if (failing) {
      failing = false;
      onError(new Error('offline'));
      return () => {};
    }
    listeners.add(entry);
    onChange(current);
    return () => {
      listeners.delete(entry);
    };
  },
);

const defaultSubscribe = subscribeToRole.getMockImplementation()!;

let others: Record<string, RoleDoc> = {};

/** Roles of other members, as their profiles see them. */
export function setMockRolesFor(roles: Record<string, RoleDoc>) {
  others = roles;
}

export const fetchRole = jest.fn(async (uid: string) => others[uid] ?? null);

export const setRole = jest.fn(async () => {});
export const removeRole = jest.fn(async () => {});

export function resetRolesMock(initial: RoleDoc | null = null) {
  current = initial;
  failing = false;
  listeners.clear();
  subscribeToRole.mockClear();
  subscribeToRole.mockImplementation(defaultSubscribe);
  others = {};
  fetchRole.mockClear();
  setRole.mockReset().mockResolvedValue(undefined);
  removeRole.mockReset().mockResolvedValue(undefined);
}

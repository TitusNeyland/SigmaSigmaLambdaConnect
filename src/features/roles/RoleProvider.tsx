import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { subscribeToRole } from '@/data/roles';
import type { RoleDoc } from '@/data/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSession } from '@/features/auth/session';

import { accessLevelFor, can, roleLabel, type AccessLevel, type Capability } from './permissions';

export type RoleState = {
  /** True until the role has loaded for an approved member. */
  loading: boolean;
  level: AccessLevel;
  role: RoleDoc | null;
  label: string;
};

const MEMBER: RoleState = { loading: false, level: 'member', role: null, label: 'Member' };

const RoleContext = createContext<RoleState>(MEMBER);

/**
 * Loads the signed-in person's role once they're approved. Updates live, so a promotion or
 * demotion takes effect without restarting. If the role can't load, the person is treated
 * as a regular member: the UI fails closed.
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { status } = useSession();
  const uid = status === 'approved' && auth.status === 'signedIn' ? auth.user.uid : null;
  const [loaded, setLoaded] = useState<{ uid: string; role: RoleDoc | null } | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeToRole(
      uid,
      (role) => setLoaded({ uid, role }),
      () => setLoaded({ uid, role: null }),
    );
  }, [uid]);

  const value = useMemo<RoleState>(() => {
    if (!uid) return MEMBER;
    if (!loaded || loaded.uid !== uid) return { ...MEMBER, loading: true };
    return {
      loading: false,
      level: accessLevelFor(loaded.role),
      role: loaded.role,
      label: roleLabel(loaded.role),
    };
  }, [uid, loaded]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleState {
  return useContext(RoleContext);
}

/** False while the role is loading, so officer tools never flash for a regular member. */
export function useCan(capability: Capability): boolean {
  const { loading, level } = useRole();
  return !loading && can(level, capability);
}

/** Renders its children only for people with the capability. */
export function RequireCapability({
  capability,
  children,
}: {
  capability: Capability;
  children: ReactNode;
}) {
  return useCan(capability) ? <>{children}</> : null;
}

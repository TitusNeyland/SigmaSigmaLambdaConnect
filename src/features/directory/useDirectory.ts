import { useEffect, useState } from 'react';

import { fetchDirectory, type DirectoryEntry } from '@/data/directory';

export type DirectoryState =
  { state: 'loading' } | { state: 'ready'; entries: DirectoryEntry[] } | { state: 'error' };

/** Every approved brother, for the pages built from the directory. retry loads again. */
export function useDirectory(): { value: DirectoryState; retry: () => void } {
  const [value, setValue] = useState<DirectoryState>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    fetchDirectory().then(
      (entries) => live && setValue({ state: 'ready', entries }),
      () => live && setValue({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  return {
    value,
    retry: () => {
      setValue({ state: 'loading' });
      setAttempt((n) => n + 1);
    },
  };
}

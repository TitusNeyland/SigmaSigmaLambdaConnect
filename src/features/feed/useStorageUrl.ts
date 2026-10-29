import { useEffect, useState } from 'react';

import { photoUrl } from '@/data/profile';

/** Download URL for a Storage path, or null while it loads (or if it can't). */
export function useStorageUrl(path: string | null): string | null {
  const [result, setResult] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let live = true;
    photoUrl(path).then(
      (url) => live && setResult({ path, url }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [path]);
  return path && result?.path === path ? result.url : null;
}

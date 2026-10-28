'use client';

import { useEffect, useState } from 'react';

import { useOrderStore } from './order';
import { useStoryStore } from './story';

/**
 * Restores saved progress after mount. Until then components render their
 * neutral state, so server HTML and the first client render always agree.
 */
export function useHydratedStores(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([useStoryStore.persist.rehydrate(), useOrderStore.persist.rehydrate()]).finally(() => setReady(true));
  }, []);
  return ready;
}

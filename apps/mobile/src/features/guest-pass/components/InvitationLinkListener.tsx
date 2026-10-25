import { router } from 'expo-router';
import { useEffect } from 'react';

import { invitationLinks } from '../index';

/**
 * Routes invitations delivered by the link provider (Branch: app opened from
 * a link, or first open after installing from one) to the preview screen.
 * The same invitation is not pushed twice in a session (Branch and the OS can
 * both report one link).
 */
export function InvitationLinkListener() {
  useEffect(() => {
    const seen = new Set<string>();
    return invitationLinks.subscribe((ref) => {
      if (ref.kind !== 'token' || seen.has(ref.token)) return;
      seen.add(ref.token);
      router.push({ pathname: '/invite/[token]', params: { token: ref.token } });
    });
  }, []);
  return null;
}

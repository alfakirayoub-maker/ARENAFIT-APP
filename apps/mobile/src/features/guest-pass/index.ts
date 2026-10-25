import { DataError } from '@/data/errors';
import { sessionClient } from '@/features/auth';
import { secureKv } from '@/lib/secure-kv';

import { createSupabaseGuestPassRepository } from './supabase-repository';
import type { GuestPassRepository } from './types';

export { invitationLinks, linkConfig } from './link-runtime';

/** Without Supabase every Guest Pass operation fails with a `config` error (no mock backend). */
const unconfigured = new Proxy({} as GuestPassRepository, {
  get: () => () => Promise.reject(new DataError('config', 'Supabase is not configured')),
});

export const guestPassRepository: GuestPassRepository = sessionClient
  ? createSupabaseGuestPassRepository(sessionClient)
  : unconfigured;

/**
 * Raw share link token and short code of the member's own invitations, kept
 * on the member's device only (the server stores hashes and cannot show them
 * again). Lets « Partager à nouveau » resend the same link; on another device
 * the invitation is re-shared with a fresh link instead.
 */
export const shareSecrets = {
  key: (invitationId: string) => `arenafit.invite.${invitationId}`,
  async get(invitationId: string): Promise<{ shareToken: string; shortCode: string } | null> {
    try {
      const raw = await secureKv.get(shareSecrets.key(invitationId));
      return raw ? (JSON.parse(raw) as { shareToken: string; shortCode: string }) : null;
    } catch {
      return null;
    }
  },
  save: (invitationId: string, value: { shareToken: string; shortCode: string }) =>
    secureKv.set(shareSecrets.key(invitationId), JSON.stringify(value)).catch(() => {}),
  remove: (invitationId: string) => secureKv.remove(shareSecrets.key(invitationId)).catch(() => {}),
};

/** The guest's raw QR token (returned once at activation), per guest identity. */
export const qrTokens = {
  key: (userId: string) => `arenafit.guest-qr.${userId}`,
  get: (userId: string) => secureKv.get(qrTokens.key(userId)).catch(() => null),
  save: (userId: string, token: string) => secureKv.set(qrTokens.key(userId), token).catch(() => {}),
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { identity } from '@/features/auth';
import { useSession } from '@/features/session/session';

import { guestPassRepository as repo, invitationLinks, shareSecrets } from './index';
import { buildShareMessage, type InvitationRef } from './links';
import { shareOnWhatsApp, shareText, type ShareOutcome } from './share';
import { GuestPassError, type ActivationResult } from './types';

export const guestPassKeys = {
  all: ['guest-pass'] as const,
  invitations: ['guest-pass', 'invitations'] as const,
  pass: ['guest-pass', 'pass'] as const,
  preview: (ref: InvitationRef) => ['guest-pass', 'preview', ref.kind, ref.kind === 'token' ? ref.token : ref.code] as const,
};

/** Signed-in member with a real backend (not the dev demo member). */
export function useCanOfferPasses(): boolean {
  const { session } = useSession();
  return session.kind === 'member' && !session.demo;
}

// ---------------------------------------------------------------------------
// Member
// ---------------------------------------------------------------------------

export function useMyInvitations() {
  const enabled = useCanOfferPasses();
  return useQuery({
    queryKey: guestPassKeys.invitations,
    queryFn: () => repo.getMyInvitations(),
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteeName: string | null) => {
      const created = await repo.createInvitation(inviteeName);
      await shareSecrets.save(created.invitationId, { shareToken: created.shareToken, shortCode: created.shortCode });
      return { ...created, url: invitationLinks.buildShareUrl(created.shareToken) };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: guestPassKeys.invitations }),
  });
}

/** Link and code of an invitation still waiting to be activated. */
export function useInvitationShareDetails(invitationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['guest-pass', 'secrets', invitationId],
    queryFn: async () => {
      const secrets = await shareSecrets.get(invitationId);
      return secrets ? { url: invitationLinks.buildShareUrl(secrets.shareToken), shortCode: secrets.shortCode } : null;
    },
    enabled,
    staleTime: Infinity,
  });
}

/**
 * Opens the share sheet (or WhatsApp) for an invitation. Uses the link kept on
 * this device; when it isn't here (other phone, reinstall), the server issues
 * a fresh link and code and the previous ones stop working.
 */
export function useShareInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invitationId, via }: { invitationId: string; via: 'sheet' | 'whatsapp' }): Promise<ShareOutcome> => {
      let secrets = await shareSecrets.get(invitationId);
      if (!secrets) {
        const fresh = await repo.reshareInvitation(invitationId);
        secrets = { shareToken: fresh.shareToken, shortCode: fresh.shortCode };
        await shareSecrets.save(invitationId, secrets);
        await qc.invalidateQueries({ queryKey: ['guest-pass', 'secrets', invitationId] });
      }
      const message = buildShareMessage(invitationLinks.buildShareUrl(secrets.shareToken));
      const outcome = via === 'whatsapp' ? await shareOnWhatsApp(message) : await shareText(message);
      if (outcome !== 'dismissed') await repo.recordShared(invitationId).catch(() => {});
      return outcome;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: guestPassKeys.invitations }),
  });
}

export function useCancelInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await repo.cancelInvitation(invitationId);
      await shareSecrets.remove(invitationId);
      return result;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: guestPassKeys.invitations }),
  });
}

// ---------------------------------------------------------------------------
// Invitee / guest
// ---------------------------------------------------------------------------

export function useInvitationPreview(ref: InvitationRef | null) {
  return useQuery({
    queryKey: ref ? guestPassKeys.preview(ref) : ['guest-pass', 'preview', 'none'],
    queryFn: () => repo.previewInvitation(ref!.kind === 'token' ? { token: ref!.token } : { code: ref!.code }),
    enabled: ref !== null,
    staleTime: 0,
  });
}

/**
 * « Activer mon Pass »: creates the guest identity now (not before), then
 * claims the invitation atomically on the server. If the claim fails, an
 * identity created for this attempt is discarded again.
 */
export function useActivateInvitation() {
  const qc = useQueryClient();
  const { refresh } = useSession();
  return useMutation({
    mutationFn: async (ref: InvitationRef): Promise<ActivationResult> => {
      if (!identity) throw new GuestPassError('no_identity');
      const { created } = await identity.ensureGuestIdentity();
      let result: ActivationResult;
      try {
        result = await repo.activateInvitation(ref.kind === 'token' ? { token: ref.token } : { code: ref.code });
      } catch (e) {
        if (created) await identity.signOut().catch(() => {});
        throw e;
      }
      const holdsPass = result.result === 'activated' || result.result === 'already_active' || result.result === 'used';
      if (!holdsPass && created) await identity.signOut().catch(() => {});
      return result;
    },
    onSuccess: async () => {
      await refresh();
      await qc.invalidateQueries({ queryKey: guestPassKeys.all });
    },
  });
}

export function useMyGuestPass() {
  const { session } = useSession();
  return useQuery({
    queryKey: guestPassKeys.pass,
    queryFn: () => repo.getMyGuestPass(),
    enabled: session.kind === 'guest',
    staleTime: 60_000,
  });
}

/**
 * « Scanner le QR »: redeems the signed-in guest's own pass at the station
 * whose reception QR was scanned. Only the scanned payload is sent — the
 * server identifies the guest from the session.
 */
export function useRedeemGuestPass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (receptionQr: string) => repo.redeemMyGuestPass(receptionQr),
    onSettled: () => qc.invalidateQueries({ queryKey: guestPassKeys.pass }),
  });
}

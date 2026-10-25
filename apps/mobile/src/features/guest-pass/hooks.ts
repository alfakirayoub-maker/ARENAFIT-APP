import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { identity } from '@/features/auth';
import { useSession } from '@/features/session/session';

import { checkInView, serverTimeMs } from './checkin';
import { guestPassRepository as repo, invitationLinks, shareSecrets } from './index';
import { buildShareMessage, type InvitationRef } from './links';
import { shareOnWhatsApp, shareText, type ShareOutcome } from './share';
import { GuestPassError, type ActivationResult, type GuestPass, type RedemptionResult } from './types';

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
 * Redeems the signed-in guest's own pass at the station whose reception QR was
 * scanned. Only the scanned payload is sent — the server identifies the guest.
 * The cached pass is updated from the SERVER response (status, time, window),
 * never from local assumptions, then refetched. Plain function (not a hook) so
 * the scanner's ScanController can own the single in-flight request.
 */
export async function redeemAndUpdatePass(qc: QueryClient, receptionQr: string): Promise<RedemptionResult> {
  const r = await repo.redeemMyGuestPass(receptionQr);
  if (r.result === 'redeemed' || r.result === 'already_used') {
    qc.setQueryData<GuestPass | null>(guestPassKeys.pass, (prev) =>
      prev
        ? {
            ...prev,
            status: 'used',
            redeemedAt: r.redeemedAt,
            stationName: r.stationName,
            confirmationUntil: r.confirmationUntil,
            clockOffsetMs: r.clockOffsetMs,
          }
        : prev,
    );
  }
  void qc.invalidateQueries({ queryKey: guestPassKeys.pass });
  return r;
}

/**
 * Live (« PASS VALIDÉ ») vs used (« PASS UTILISÉ ») for a redeemed pass, from
 * server time; re-evaluated every second so the screen switches by itself
 * when the window ends. Also returns the server-aligned clock for display.
 */
export function useCheckInView(pass: Pick<GuestPass, 'confirmationUntil' | 'clockOffsetMs'> | null | undefined) {
  const [deviceNow, setDeviceNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setDeviceNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const offset = pass?.clockOffsetMs ?? 0;
  return {
    view: pass ? checkInView(pass, deviceNow) : ({ kind: 'used' } as const),
    serverNow: new Date(serverTimeMs(offset, deviceNow)),
  };
}

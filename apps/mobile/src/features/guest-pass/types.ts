import type { GuestInvitationStatus } from '@/types/domain';

export type { GuestInvitationStatus };

/** A member's invitation as listed in Profil › Pass & Invitations. */
export type Invitation = {
  id: string;
  inviteeName: string | null;
  status: GuestInvitationStatus;
  /** ISO 8601 instants */
  createdAt: string;
  expiresAt: string;
  activatedAt: string | null;
  usedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  convertedAt: string | null;
  lastSharedAt: string | null;
};

export type InvitationsOverview = {
  allowance: number;
  /** Passes the member can still offer. */
  available: number;
  invitations: Invitation[];
};

/** Raw secrets returned once by create / re-share. Never persisted server-side. */
export type ShareSecrets = {
  invitationId: string;
  shareToken: string;
  shortCode: string;
  expiresAt: string;
};

export type PreviewResult =
  | 'valid'
  | 'yours'
  | 'already_claimed'
  | 'expired'
  | 'cancelled'
  | 'invalid'
  | 'rate_limited';

export type InvitationPreview = {
  result: PreviewResult;
  inviterName: string | null;
  sessions: number | null;
  expiresAt: string | null;
};

export type GuestPass = {
  status: GuestInvitationStatus;
  inviterName: string | null;
  sessions: number;
  validUntil: string;
  activatedAt: string | null;
  usedAt: string | null;
  qrIssuedAt: string;
};

export type ActivationResult =
  | { result: 'activated'; qrToken: string; pass: GuestPass }
  | { result: 'already_active' | 'used'; pass: GuestPass }
  | {
      result:
        | 'expired'
        | 'cancelled'
        | 'already_claimed'
        | 'own_invitation'
        | 'not_eligible'
        | 'has_active_pass'
        | 'invalid'
        | 'rate_limited';
    };

/** Business refusals raised by the server operations (P0001 "gp_*"). */
export type GuestPassErrorCode =
  | 'not_eligible'
  | 'no_pass_available'
  | 'daily_limit'
  | 'invalid_name'
  | 'invalid_configuration'
  | 'not_found'
  | 'not_shareable'
  | 'not_cancellable'
  | 'no_active_pass'
  | 'no_identity';

export class GuestPassError extends Error {
  readonly code: GuestPassErrorCode;

  constructor(code: GuestPassErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = 'GuestPassError';
    this.code = code;
  }
}

/** Server operations behind the Guest Pass flow. No table is ever written directly. */
export interface GuestPassRepository {
  // Member
  getMyInvitations(): Promise<InvitationsOverview>;
  createInvitation(inviteeName: string | null): Promise<ShareSecrets & { available: number }>;
  reshareInvitation(invitationId: string): Promise<ShareSecrets>;
  recordShared(invitationId: string): Promise<void>;
  cancelInvitation(invitationId: string): Promise<{ available: number }>;
  // Anyone holding a secret
  previewInvitation(ref: { token?: string; code?: string }): Promise<InvitationPreview>;
  // Guest identity
  activateInvitation(ref: { token?: string; code?: string }): Promise<ActivationResult>;
  getMyGuestPass(): Promise<GuestPass | null>;
  reissueQr(): Promise<{ qrToken: string }>;
}

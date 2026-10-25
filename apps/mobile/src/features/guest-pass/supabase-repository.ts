import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { DataError } from '@/data/errors';

import {
  GuestPassError,
  type ActivationResult,
  type GuestPass,
  type GuestPassErrorCode,
  type GuestPassRepository,
  type Invitation,
  type InvitationPreview,
  type RedemptionResult,
} from './types';

const status = z.enum(['sent', 'activated', 'used', 'expired', 'cancelled', 'converted']);
const instant = z.string();
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const invitationRow = z.object({
  id: z.uuid(),
  invitee_name: z.string().nullable(),
  status,
  created_at: instant,
  expires_at: instant,
  activated_at: instant.nullable(),
  used_at: instant.nullable(),
  cancelled_at: instant.nullable(),
  expired_at: instant.nullable(),
  converted_at: instant.nullable(),
  last_shared_at: instant.nullable(),
});

const overviewRow = z.object({ allowance: z.number().int(), available: z.number().int(), invitations: z.array(invitationRow) });
const secretsRow = z.object({ invitation_id: z.uuid(), share_token: token, short_code: z.string(), expires_at: instant });
const createdRow = secretsRow.extend({ available: z.number().int() });

const passRow = z.object({
  status,
  inviter_name: z.string().nullable(),
  sessions: z.number().int(),
  valid_until: instant,
  activated_at: instant.nullable(),
  redeemed_at: instant.nullable(),
  station_name: z.string().nullable(),
});

const previewRow = z.object({
  result: z.enum(['valid', 'yours', 'already_claimed', 'expired', 'cancelled', 'invalid', 'rate_limited']),
  inviter_name: z.string().nullable().optional(),
  sessions: z.number().int().nullable().optional(),
  expires_at: instant.nullable().optional(),
});

const activationRow = z.discriminatedUnion('result', [
  z.object({ result: z.enum(['activated', 'already_active', 'used']), pass: passRow }),
  z.object({
    result: z.enum([
      'expired',
      'cancelled',
      'already_claimed',
      'own_invitation',
      'not_eligible',
      'has_active_pass',
      'invalid',
      'rate_limited',
    ]),
  }),
]);

const ERROR_CODES: readonly GuestPassErrorCode[] = [
  'not_eligible',
  'no_pass_available',
  'daily_limit',
  'invalid_name',
  'invalid_configuration',
  'not_found',
  'not_shareable',
  'not_cancellable',
];

const redemptionRow = z.discriminatedUnion('result', [
  z.object({ result: z.literal('redeemed'), redeemed_at: instant, station_name: z.string(), sessions: z.number().int() }),
  z.object({ result: z.literal('already_used'), redeemed_at: instant.nullable(), station_name: z.string().nullable().optional() }),
  z.object({ result: z.literal('expired'), valid_until: instant.nullable().optional() }),
  z.object({ result: z.enum(['no_pass', 'invalid_qr', 'station_inactive', 'not_guest']) }),
]);

type RpcResult = { data: unknown; error: PostgrestError | null; status: number };

/** Calls a server operation and validates its JSON result. */
async function call<T extends z.ZodType>(
  schema: T,
  request: PromiseLike<RpcResult>,
): Promise<z.infer<T>> {
  let res: RpcResult;
  try {
    res = await request;
  } catch (cause) {
    throw new DataError('network', 'Network request failed', { cause });
  }
  if (res.error) {
    // Business refusals: raise exception 'gp_<code>' using errcode 'P0001'.
    const code = res.error.code === 'P0001' && res.error.message.startsWith('gp_') ? res.error.message.slice(3) : null;
    if (code && (ERROR_CODES as readonly string[]).includes(code)) {
      throw new GuestPassError(code as GuestPassErrorCode, { cause: res.error });
    }
    const kind = res.status === 0 ? 'network' : res.status >= 500 ? 'server' : 'rejected';
    throw new DataError(kind, res.error.message, { cause: res.error });
  }
  const parsed = schema.safeParse(res.data);
  if (!parsed.success) throw new DataError('invalid-data', 'Unexpected response shape', { cause: parsed.error });
  return parsed.data;
}

const toInvitation = (r: z.infer<typeof invitationRow>): Invitation => ({
  id: r.id,
  inviteeName: r.invitee_name,
  status: r.status,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  activatedAt: r.activated_at,
  usedAt: r.used_at,
  cancelledAt: r.cancelled_at,
  expiredAt: r.expired_at,
  convertedAt: r.converted_at,
  lastSharedAt: r.last_shared_at,
});

const toPass = (r: z.infer<typeof passRow>): GuestPass => ({
  status: r.status,
  inviterName: r.inviter_name,
  sessions: r.sessions,
  validUntil: r.valid_until,
  activatedAt: r.activated_at,
  redeemedAt: r.redeemed_at,
  stationName: r.station_name,
});

const refArgs = (ref: { token?: string; code?: string }) => ({ p_token: ref.token ?? null, p_code: ref.code ?? null });

/**
 * Guest Pass operations over Supabase RPC (SECURITY DEFINER functions in
 * supabase/migrations/20261026000000_guest_pass_flow.sql). The client must
 * carry the caller's session: member for invitations, guest for passes.
 */
export function createSupabaseGuestPassRepository(client: SupabaseClient): GuestPassRepository {
  return {
    async getMyInvitations() {
      const r = await call(overviewRow, client.rpc('get_my_guest_invitations'));
      return { allowance: r.allowance, available: r.available, invitations: r.invitations.map(toInvitation) };
    },

    async createInvitation(inviteeName) {
      const r = await call(createdRow, client.rpc('create_guest_invitation', { p_invitee_name: inviteeName }));
      return {
        invitationId: r.invitation_id,
        shareToken: r.share_token,
        shortCode: r.short_code,
        expiresAt: r.expires_at,
        available: r.available,
      };
    },

    async reshareInvitation(invitationId) {
      const r = await call(secretsRow, client.rpc('reshare_guest_invitation', { p_invitation_id: invitationId }));
      return { invitationId: r.invitation_id, shareToken: r.share_token, shortCode: r.short_code, expiresAt: r.expires_at };
    },

    async recordShared(invitationId) {
      await call(z.unknown(), client.rpc('record_guest_invitation_shared', { p_invitation_id: invitationId }));
    },

    async cancelInvitation(invitationId) {
      const r = await call(
        z.object({ available: z.number().int() }),
        client.rpc('cancel_guest_invitation', { p_invitation_id: invitationId }),
      );
      return { available: r.available };
    },

    async previewInvitation(ref): Promise<InvitationPreview> {
      const r = await call(previewRow, client.rpc('preview_guest_invitation', refArgs(ref)));
      return {
        result: r.result,
        inviterName: r.inviter_name ?? null,
        sessions: r.sessions ?? null,
        expiresAt: r.expires_at ?? null,
      };
    },

    async activateInvitation(ref): Promise<ActivationResult> {
      const r = await call(activationRow, client.rpc('activate_guest_invitation', refArgs(ref)));
      if ('pass' in r) return { result: r.result, pass: toPass(r.pass) };
      return { result: r.result };
    },

    async getMyGuestPass() {
      const r = await call(passRow.nullable(), client.rpc('get_my_guest_pass'));
      return r ? toPass(r) : null;
    },

    async redeemMyGuestPass(receptionQr): Promise<RedemptionResult> {
      const r = await call(redemptionRow, client.rpc('redeem_my_guest_pass', { p_reception_qr: receptionQr }));
      switch (r.result) {
        case 'redeemed':
          return { result: r.result, redeemedAt: r.redeemed_at, stationName: r.station_name, sessions: r.sessions };
        case 'already_used':
          return { result: r.result, redeemedAt: r.redeemed_at, stationName: r.station_name ?? null };
        case 'expired':
          return { result: r.result, validUntil: r.valid_until ?? null };
        default:
          return { result: r.result };
      }
    },
  };
}

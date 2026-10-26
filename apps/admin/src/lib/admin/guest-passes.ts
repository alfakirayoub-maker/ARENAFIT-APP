import { z } from 'zod';

import { runParsed, type Db } from './core';

export const INVITATION_STATUSES = ['sent', 'activated', 'used', 'expired', 'cancelled', 'converted'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

const ts = z.string().nullable();
const invitation = z.object({
  id: z.uuid(),
  inviter_name: z.string().nullable(),
  invitee_name: z.string().nullable(),
  status: z.enum(INVITATION_STATUSES),
  guest_activated: z.boolean(),
  created_at: z.string(),
  last_shared_at: ts,
  activated_at: ts,
  expires_at: z.string(),
  expired_at: ts,
  cancelled_at: ts,
  used_at: ts,
  converted_at: ts,
  redeemed_at: ts,
  reception_station_name: z.string().nullable(),
});
export type AdminInvitation = z.output<typeof invitation>;

const detail = invitation.extend({
  events: z.array(
    z.object({ event: z.string(), outcome: z.string().nullable(), station_name: z.string().nullable(), created_at: z.string() }),
  ),
});
export type AdminInvitationDetail = z.output<typeof detail>;

export const listInvitations = (db: Db, filter: { status?: InvitationStatus | null; search?: string }) =>
  runParsed(
    z.array(invitation),
    db.rpc('admin_list_guest_invitations', { p_status: filter.status ?? null, p_search: filter.search?.trim() || null, p_limit: 300 }),
  );

export const getInvitation = (db: Db, id: string) => runParsed(detail.nullable(), db.rpc('admin_guest_invitation_detail', { p_id: id }));

export const cancelInvitation = (db: Db, id: string) => runParsed(invitation, db.rpc('admin_cancel_guest_invitation', { p_id: id }));

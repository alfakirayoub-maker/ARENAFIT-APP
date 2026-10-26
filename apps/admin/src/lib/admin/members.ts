import { z } from 'zod';

import { runParsed, type Db } from './core';

const member = z.object({
  id: z.uuid(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  plan_name: z.string().nullable(),
  membership_status: z.string().nullable(),
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
  allowance: z.number(),
  available: z.number(),
  invitations: z.number(),
});
export type AdminMember = z.output<typeof member>;

export const listMembers = (db: Db, search?: string) =>
  runParsed(z.array(member), db.rpc('admin_list_members', { p_search: search?.trim() || null }));

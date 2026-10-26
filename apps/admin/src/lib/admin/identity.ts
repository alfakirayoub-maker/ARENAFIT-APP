import { z } from 'zod';

import { isStaffRole, type StaffRole } from '../roles';
import { runParsed, type Db } from './core';

export type StaffIdentity = { userId: string; role: StaffRole; displayName: string | null; email: string | null };

const whoami = z
  .object({ user_id: z.uuid(), role: z.string(), display_name: z.string().nullable(), email: z.string().nullable() })
  .nullable();

/** The signed-in user's staff identity, or null if they are not staff. */
export async function getStaffIdentity(db: Db): Promise<StaffIdentity | null> {
  const r = await runParsed(whoami, db.rpc('admin_whoami'));
  if (!r || !isStaffRole(r.role)) return null;
  return { userId: r.user_id, role: r.role, displayName: r.display_name, email: r.email };
}

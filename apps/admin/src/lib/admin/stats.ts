import { z } from 'zod';

import { runParsed, type Db } from './core';

/** Figures of sections the role can't see come back null from the database. */
const statsSchema = z.object({
  club_today: z.string(),
  sessions_today: z.number(),
  sessions_week: z.number(),
  cancelled_week: z.number(),
  news_published: z.number().nullable(),
  news_drafts: z.number().nullable(),
  passes_active: z.number().nullable(),
  passes_used_today: z.number().nullable(),
  invitations_pending: z.number().nullable(),
});
export type DashboardStats = z.output<typeof statsSchema>;

export const getDashboardStats = (db: Db) => runParsed(statsSchema, db.rpc('admin_dashboard_stats'));

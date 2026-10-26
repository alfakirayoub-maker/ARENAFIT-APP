'use client';

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { useToast } from '@/components/Toast';

import type { ClubDate } from '../dates';
import { messageFor } from '../errors';
import { getBrowserClient } from '../supabase/browser';
import { listAudit } from './audit';
import { getActivity, getCoach, listActivities, listCoaches } from './catalogue';
import { getInvitation, listInvitations, type InvitationStatus } from './guest-passes';
import { listMembers } from './members';
import { getNews, listNews } from './news';
import { listNotifications } from './notifications';
import { coachActivityMap, getSession, listRooms, listSessions } from './planning';
import { getDashboardStats } from './stats';
import { listStations } from './stations';

/**
 * Query/mutation hooks: the only bridge between pages and repositories.
 * Pages never call Supabase directly.
 */
export const keys = {
  stats: ['stats'] as const,
  sessions: (from: ClubDate, to: ClubDate) => ['sessions', from, to] as const,
  sessionsAll: ['sessions'] as const,
  session: (id: string) => ['session', id] as const,
  rooms: ['rooms'] as const,
  coaches: ['coaches'] as const,
  coach: (id: string) => ['coach', id] as const,
  coachActivities: ['coach-activities'] as const,
  activities: ['activities'] as const,
  activity: (id: string) => ['activity', id] as const,
  news: ['news'] as const,
  newsItem: (id: string) => ['news', id] as const,
  invitations: (status: string | null, search: string) => ['invitations', status, search] as const,
  invitationsAll: ['invitations'] as const,
  invitation: (id: string) => ['invitation', id] as const,
  stations: ['stations'] as const,
  members: (search: string) => ['members', search] as const,
  notifications: ['notifications'] as const,
  audit: (entityId?: string) => ['audit', entityId ?? 'all'] as const,
};

const db = () => getBrowserClient();

export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: () => getDashboardStats(db()) });
export const useSessions = (from: ClubDate, to: ClubDate) =>
  useQuery({ queryKey: keys.sessions(from, to), queryFn: () => listSessions(db(), { from, to }) });
export const useSession = (id: string | null) =>
  useQuery({ queryKey: keys.session(id ?? 'new'), queryFn: () => getSession(db(), id!), enabled: !!id });
export const useRooms = () => useQuery({ queryKey: keys.rooms, queryFn: () => listRooms(db()), staleTime: 300_000 });
export const useCoaches = () => useQuery({ queryKey: keys.coaches, queryFn: () => listCoaches(db()) });
export const useCoach = (id: string | null) =>
  useQuery({ queryKey: keys.coach(id ?? 'new'), queryFn: () => getCoach(db(), id!), enabled: !!id });
export const useCoachActivityMap = () => useQuery({ queryKey: keys.coachActivities, queryFn: () => coachActivityMap(db()) });
export const useActivities = () => useQuery({ queryKey: keys.activities, queryFn: () => listActivities(db()) });
export const useActivity = (id: string | null) =>
  useQuery({ queryKey: keys.activity(id ?? 'new'), queryFn: () => getActivity(db(), id!), enabled: !!id });
export const useNewsList = () => useQuery({ queryKey: keys.news, queryFn: () => listNews(db()) });
export const useNewsItem = (id: string | null) =>
  useQuery({ queryKey: keys.newsItem(id ?? 'new'), queryFn: () => getNews(db(), id!), enabled: !!id });
export const useInvitations = (status: InvitationStatus | null, search: string) =>
  useQuery({ queryKey: keys.invitations(status, search), queryFn: () => listInvitations(db(), { status, search }) });
export const useInvitation = (id: string) => useQuery({ queryKey: keys.invitation(id), queryFn: () => getInvitation(db(), id) });
export const useStations = () => useQuery({ queryKey: keys.stations, queryFn: () => listStations(db()) });
export const useMembers = (search: string) => useQuery({ queryKey: keys.members(search), queryFn: () => listMembers(db(), search) });
export const useNotifications = () => useQuery({ queryKey: keys.notifications, queryFn: () => listNotifications(db()) });
/** Audit history is admin-only: other roles never send the request. */
export const useAudit = (entityId: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: keys.audit(entityId), queryFn: () => listAudit(db(), entityId), enabled });

/**
 * Mutation with toast feedback and cache invalidation. `run` receives the
 * browser client; errors are shown as French messages.
 */
export function useAction<TArgs, TResult>(
  run: (client: ReturnType<typeof getBrowserClient>, args: TArgs) => Promise<TResult>,
  options: { success?: string | ((r: TResult) => string); invalidate?: QueryKey[]; onSuccess?: (r: TResult) => void; gcTime?: number } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (args: TArgs) => run(db(), args),
    gcTime: options.gcTime,
    onSuccess: async (r) => {
      await Promise.all([...(options.invalidate ?? []), keys.stats].map((k) => qc.invalidateQueries({ queryKey: k })));
      if (options.success) toast(typeof options.success === 'function' ? options.success(r) : options.success);
      options.onSuccess?.(r);
    },
    onError: (e) => toast(messageFor(e), true),
  });
}

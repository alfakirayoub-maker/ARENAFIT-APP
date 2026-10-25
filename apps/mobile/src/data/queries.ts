import { QueryClient, useQuery } from '@tanstack/react-query';

import type { ClubDate } from '@/lib/club-time';

import { fixtureRepository } from './fixture-repository';
import type { ContentRepository } from './repository';

// Swapped for the Supabase repository in Sprint 3.
const repository: ContentRepository = fixtureRepository;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Schedule and content change a few times a day at most.
      staleTime: 5 * 60_000,
      retry: 2,
    },
  },
});

export const queryKeys = {
  sessions: (from: ClubDate, to: ClubDate) => ['sessions', from, to] as const,
  session: (id: string) => ['session', id] as const,
  activities: ['activities'] as const,
  activity: (slug: string) => ['activity', slug] as const,
  coaches: ['coaches'] as const,
  coach: (slug: string) => ['coach', slug] as const,
  news: ['news'] as const,
  article: (slug: string) => ['news', slug] as const,
};

export function useSessions(from: ClubDate, to: ClubDate) {
  return useQuery({ queryKey: queryKeys.sessions(from, to), queryFn: () => repository.listSessions({ from, to }) });
}

export function useClassSession(id: string) {
  return useQuery({ queryKey: queryKeys.session(id), queryFn: () => repository.getSession(id), enabled: id !== '' });
}

export function useActivities() {
  return useQuery({ queryKey: queryKeys.activities, queryFn: () => repository.listActivities() });
}

export function useActivity(slug: string) {
  return useQuery({ queryKey: queryKeys.activity(slug), queryFn: () => repository.getActivity(slug), enabled: slug !== '' });
}

export function useCoaches() {
  return useQuery({ queryKey: queryKeys.coaches, queryFn: () => repository.listCoaches() });
}

export function useCoach(slug: string) {
  return useQuery({ queryKey: queryKeys.coach(slug), queryFn: () => repository.getCoach(slug), enabled: slug !== '' });
}

export function useNews() {
  return useQuery({ queryKey: queryKeys.news, queryFn: () => repository.listNews() });
}

export function useArticle(slug: string) {
  return useQuery({ queryKey: queryKeys.article(slug), queryFn: () => repository.getNews(slug), enabled: slug !== '' });
}

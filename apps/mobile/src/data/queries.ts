import {
  QueryClient,
  focusManager,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { requestReminderReconciliation } from '@/features/reminders/reconcile-requests';
import { addDays, clubNow, startOfWeek, type ClubDate } from '@/lib/club-time';
import type { Activity, ActivityCategory, ClassSession, Coach, NewsArticle } from '@/types/domain';

import { isRetryable } from './errors';
import { repository } from './source';

/**
 * Query layer: the only bridge between screens and the repository.
 *
 * Cache strategy
 *  - Catalogue (coaches, activities) changes rarely: 30 min stale time.
 *  - Planning and news: 5 / 10 min stale time; refetched on app foreground and
 *    pull-to-refresh only when stale — navigating between screens never
 *    refetches fresh data.
 *  - The planning is fetched one week at a time; day and category filters are
 *    derived from the cached week (`select`), so switching them is instant.
 *  - Detail screens start from list data already in the cache (`initialData`),
 *    then revalidate in the background.
 *  - Cached data stays on screen when a refetch fails; screens show the error
 *    state only when there is nothing to show.
 */

const MINUTE = 60_000;
const STALE = { catalogue: 30 * MINUTE, sessions: 5 * MINUTE, news: 10 * MINUTE } as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.sessions,
      gcTime: 24 * 60 * MINUTE,
      // Network/server errors: retry twice with backoff. Rejections (RLS, bad
      // key), invalid data and missing config: fail immediately.
      retry: (failureCount, error) => isRetryable(error) && failureCount < 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    },
  },
});

export const queryKeys = {
  sessions: ['sessions'] as const,
  sessionRange: (from: ClubDate, to: ClubDate) => ['sessions', 'range', from, to] as const,
  upcoming: (filter: { activityId?: string; coachId?: string; limit: number }) => ['sessions', 'upcoming', filter] as const,
  session: (id: string) => ['sessions', 'detail', id] as const,
  activities: ['activities'] as const,
  activityList: ['activities', 'list'] as const,
  activity: (slug: string) => ['activities', 'detail', slug] as const,
  activitiesForCoach: (coachId: string) => ['activities', 'by-coach', coachId] as const,
  coaches: ['coaches'] as const,
  coachList: ['coaches', 'list'] as const,
  coach: (slug: string) => ['coaches', 'detail', slug] as const,
  coachesForActivity: (activityId: string) => ['coaches', 'by-activity', activityId] as const,
  news: ['news'] as const,
  newsList: ['news', 'list'] as const,
  article: (slug: string) => ['news', 'detail', slug] as const,
};

/** Refetch stale queries when the app returns to the foreground. */
export function useRefetchOnAppForeground() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    return () => sub.remove();
  }, []);
}

/** Pull-to-refresh: invalidates the given query families (refetching the ones on screen). */
export function useRefresh(...families: QueryKey[]) {
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all(families.map((queryKey) => client.invalidateQueries({ queryKey })));
      // A refreshed planning may have moved or cancelled classes with reminders.
      if (families.some((f) => f[0] === queryKeys.sessions[0])) requestReminderReconciliation();
    } finally {
      setRefreshing(false);
    }
  };
  return { refreshing, onRefresh };
}

/**
 * Seeds a detail query from list data already cached for the same family, and
 * keeps the list's fetch time so staleness (and background revalidation) stays
 * truthful.
 */
function seedFromLists<T>(family: QueryKey, predicate: (item: T) => boolean) {
  const find = () => {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: family })) {
      const data = query.state.data;
      if (!Array.isArray(data)) continue;
      const item = (data as T[]).find(predicate);
      if (item) return { item, updatedAt: query.state.dataUpdatedAt };
    }
    return undefined;
  };
  return {
    initialData: () => find()?.item,
    initialDataUpdatedAt: () => find()?.updatedAt,
  };
}

// Planning --------------------------------------------------------------------

function weekRange(monday: ClubDate) {
  return { from: monday, to: addDays(monday, 6) };
}

function rangeQuery(from: ClubDate, to: ClubDate) {
  return {
    queryKey: queryKeys.sessionRange(from, to),
    queryFn: () => repository.listSessions({ from, to }),
    staleTime: STALE.sessions,
  };
}

/**
 * One week of planning (Monday → Sunday), optionally narrowed to a day and/or
 * category from the cached week — no extra request when filters change.
 */
export function useWeekSessions(monday: ClubDate, filter: { date?: ClubDate; category?: ActivityCategory } = {}) {
  const { from, to } = weekRange(monday);
  const { date, category } = filter;
  return useQuery({
    ...rangeQuery(from, to),
    select: useCallback(
      (sessions: ClassSession[]) =>
        sessions.filter((s) => (!date || s.date === date) && (!category || s.activity.category === category)),
      [date, category],
    ),
  });
}

/** Today's sessions (club-local), shared with the planning's current-week cache. */
export function useTodaySessions() {
  const today = clubNow().date;
  return useWeekSessions(startOfWeek(today), { date: today });
}

/** Warm the cache for a week the user is likely to open next. */
export function prefetchWeek(monday: ClubDate) {
  const { from, to } = weekRange(monday);
  return queryClient.prefetchQuery(rangeQuery(from, to));
}

/** Next sessions that haven't started (re-filtered locally as the clock moves). */
export function useUpcomingSessions(
  filter: { activityId?: string; coachId?: string; limit: number },
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: queryKeys.upcoming(filter),
    queryFn: () => repository.listUpcomingSessions({ ...filter, now: clubNow() }),
    staleTime: STALE.sessions,
    select: (sessions: ClassSession[]) => {
      const now = clubNow();
      return sessions.filter((s) => s.date > now.date || (s.date === now.date && s.startTime > now.time));
    },
  });
}

export function useClassSession(id: string) {
  return useQuery({
    queryKey: queryKeys.session(id),
    queryFn: () => repository.getSession(id),
    enabled: id !== '',
    staleTime: STALE.sessions,
    ...seedFromLists<ClassSession>(queryKeys.sessions, (s) => s.id === id),
  });
}

// Activities ------------------------------------------------------------------

export function useActivities() {
  return useQuery({
    queryKey: queryKeys.activityList,
    queryFn: () => repository.listActivities(),
    staleTime: STALE.catalogue,
  });
}

export function useActivity(slug: string) {
  return useQuery({
    queryKey: queryKeys.activity(slug),
    queryFn: () => repository.getActivity(slug),
    enabled: slug !== '',
    staleTime: STALE.catalogue,
    ...seedFromLists<Activity>(queryKeys.activities, (a) => a.slug === slug),
  });
}

export function useCoachesForActivity(activityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.coachesForActivity(activityId ?? ''),
    queryFn: () => repository.listCoachesForActivity(activityId!),
    enabled: !!activityId,
    staleTime: STALE.catalogue,
  });
}

// Coaches ---------------------------------------------------------------------

export function useCoaches() {
  return useQuery({
    queryKey: queryKeys.coachList,
    queryFn: () => repository.listCoaches(),
    staleTime: STALE.catalogue,
  });
}

export function useCoach(slug: string) {
  return useQuery({
    queryKey: queryKeys.coach(slug),
    queryFn: () => repository.getCoach(slug),
    enabled: slug !== '',
    staleTime: STALE.catalogue,
    ...seedFromLists<Coach>(queryKeys.coaches, (c) => c.slug === slug),
  });
}

export function useActivitiesForCoach(coachId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.activitiesForCoach(coachId ?? ''),
    queryFn: () => repository.listActivitiesForCoach(coachId!),
    enabled: !!coachId,
    staleTime: STALE.catalogue,
  });
}

// News ------------------------------------------------------------------------

const newsListQuery = {
  queryKey: queryKeys.newsList,
  queryFn: () => repository.listNews(),
  staleTime: STALE.news,
};

/** Published articles, newest first, optionally narrowed to a category. */
export function useNews(category?: NewsArticle['category']) {
  return useQuery({
    ...newsListQuery,
    select: useCallback(
      (articles: NewsArticle[]) => (category ? articles.filter((a) => a.category === category) : articles),
      [category],
    ),
  });
}

/** Categories that currently have published articles (derived, no extra request). */
export function useNewsCategories() {
  return useQuery({
    ...newsListQuery,
    select: (articles: NewsArticle[]) => [...new Set(articles.map((a) => a.category))],
  });
}

export function useArticle(slug: string) {
  return useQuery({
    queryKey: queryKeys.article(slug),
    queryFn: () => repository.getNews(slug),
    enabled: slug !== '',
    staleTime: STALE.news,
    ...seedFromLists<NewsArticle>(queryKeys.news, (n) => n.slug === slug),
  });
}

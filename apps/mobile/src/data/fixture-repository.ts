import { fixtureActivities, fixtureCoaches } from '@/dev/fixtures/catalogue';
import { fixtureNews } from '@/dev/fixtures/content';
import { buildFixtureSessions } from '@/dev/fixtures/schedule';
import { clubNow } from '@/lib/club-time';

import type { ContentRepository } from './repository';

/**
 * DEVELOPMENT ONLY — serves src/dev/fixtures (mock data, not Arena Fit facts).
 * Selected in dev builds when no Supabase project is configured, or when
 * EXPO_PUBLIC_DATA_SOURCE=fixtures. Never used in release builds.
 */

// Small artificial latency so loading skeletons are exercised during development.
const LATENCY_MS = 350;
const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));

function sessions() {
  return buildFixtureSessions(clubNow().date).sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );
}

export const fixtureRepository: ContentRepository = {
  listSessions: ({ from, to }) => delay(sessions().filter((s) => s.date >= from && s.date <= to)),
  listUpcomingSessions: ({ now, limit, activityId, coachId }) =>
    delay(
      sessions()
        .filter((s) => !s.isCancelled && (s.date > now.date || (s.date === now.date && s.startTime > now.time)))
        .filter((s) => (!activityId || s.activity.id === activityId) && (!coachId || s.coach?.id === coachId))
        .slice(0, limit),
    ),
  getSession: (id) => delay(sessions().find((s) => s.id === id) ?? null),
  getSessionsByIds: (ids) => delay(sessions().filter((s) => ids.includes(s.id))),
  listActivities: () => delay(fixtureActivities),
  getActivity: (slug) => delay(fixtureActivities.find((a) => a.slug === slug) ?? null),
  listCoachesForActivity: (activityId) => delay(fixtureCoaches.filter((c) => c.activityIds.includes(activityId))),
  listCoaches: () => delay(fixtureCoaches),
  getCoach: (slug) => delay(fixtureCoaches.find((c) => c.slug === slug) ?? null),
  listActivitiesForCoach: (coachId) => delay(fixtureActivities.filter((a) => a.coachIds.includes(coachId))),
  listNews: () => delay([...fixtureNews].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))),
  getNews: (slug) => delay(fixtureNews.find((n) => n.slug === slug) ?? null),
};

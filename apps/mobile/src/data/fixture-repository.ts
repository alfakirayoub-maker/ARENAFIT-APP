import { fixtureActivities, fixtureCoaches } from '@/dev/fixtures/catalogue';
import { fixtureNews } from '@/dev/fixtures/content';
import { buildFixtureSessions } from '@/dev/fixtures/schedule';
import { clubNow } from '@/lib/club-time';

import type { ContentRepository } from './repository';

// Small artificial latency so loading skeletons are exercised during development.
const LATENCY_MS = 350;
const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));

const sortSessions = (a: { date: string; startTime: string }, b: { date: string; startTime: string }) =>
  a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);

function sessions() {
  return buildFixtureSessions(clubNow().date).sort(sortSessions);
}

export const fixtureRepository: ContentRepository = {
  listSessions: ({ from, to }) => delay(sessions().filter((s) => s.date >= from && s.date <= to)),
  getSession: (id) => delay(sessions().find((s) => s.id === id) ?? null),
  listActivities: () => delay(fixtureActivities),
  getActivity: (slug) => delay(fixtureActivities.find((a) => a.slug === slug) ?? null),
  listCoaches: () => delay(fixtureCoaches),
  getCoach: (slug) => delay(fixtureCoaches.find((c) => c.slug === slug) ?? null),
  listNews: () => delay([...fixtureNews].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))),
  getNews: (slug) => delay(fixtureNews.find((n) => n.slug === slug) ?? null),
};

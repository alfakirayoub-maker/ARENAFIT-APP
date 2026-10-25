import type { ClubDate } from '@/lib/club-time';
import type { Activity, ClassSession, Coach, NewsArticle } from '@/types/domain';

/**
 * Read access to public club content. Screens depend on this interface only:
 * Sprint 2 ships a fixture implementation, Sprint 3 adds the Supabase one.
 * None of these calls require a signed-in user.
 */
export interface ContentRepository {
  /** Sessions with `from <= date <= to`, ordered by date then start time. */
  listSessions(range: { from: ClubDate; to: ClubDate }): Promise<ClassSession[]>;
  getSession(id: string): Promise<ClassSession | null>;
  listActivities(): Promise<Activity[]>;
  getActivity(slug: string): Promise<Activity | null>;
  listCoaches(): Promise<Coach[]>;
  getCoach(slug: string): Promise<Coach | null>;
  /** Published articles, newest first. */
  listNews(): Promise<NewsArticle[]>;
  getNews(slug: string): Promise<NewsArticle | null>;
}

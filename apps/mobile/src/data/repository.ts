import type { ClubDate, ClubTime } from '@/lib/club-time';
import type { Activity, ClassSession, Coach, NewsArticle } from '@/types/domain';

/**
 * Read access to public club content — everything a visitor can see without
 * an account. Screens depend on this interface (through query hooks) only:
 * the Supabase implementation is used when configured, development fixtures
 * otherwise (dev builds only).
 *
 * Implementations must reject with `DataError` (src/data/errors.ts).
 */
export interface ContentRepository {
  // Planning ------------------------------------------------------------------
  /** Sessions with `from <= date <= to` (club-local), ordered by date then start time. */
  listSessions(range: { from: ClubDate; to: ClubDate }): Promise<ClassSession[]>;
  /**
   * Next sessions that have not started yet at club time `now`, excluding
   * cancelled ones, optionally for one activity or coach.
   */
  listUpcomingSessions(query: {
    now: { date: ClubDate; time: ClubTime };
    limit: number;
    activityId?: string;
    coachId?: string;
  }): Promise<ClassSession[]>;
  getSession(id: string): Promise<ClassSession | null>;
  /**
   * Current version of several sessions (reminder reconciliation). Ids absent
   * from the result were deleted or are no longer published.
   */
  getSessionsByIds(ids: string[]): Promise<ClassSession[]>;

  // Activities ----------------------------------------------------------------
  listActivities(): Promise<Activity[]>;
  getActivity(slug: string): Promise<Activity | null>;
  /** Coaches teaching an activity. */
  listCoachesForActivity(activityId: string): Promise<Coach[]>;

  // Coaches -------------------------------------------------------------------
  listCoaches(): Promise<Coach[]>;
  getCoach(slug: string): Promise<Coach | null>;
  /** Activities taught by a coach. */
  listActivitiesForCoach(coachId: string): Promise<Activity[]>;

  // News ----------------------------------------------------------------------
  /** Published articles, newest first. */
  listNews(): Promise<NewsArticle[]>;
  getNews(slug: string): Promise<NewsArticle | null>;
}

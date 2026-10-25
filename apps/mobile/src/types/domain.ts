/**
 * App-level view models. They mirror the Supabase schema
 * (supabase/migrations) but are shaped for the UI; repositories map database
 * rows into these types. Unknown facts are `null`, never guessed.
 */

import type { ClubDate, ClubTime } from '@/lib/club-time';

export const activityCategories = [
  'fitness',
  'combat',
  'dance',
  'aqua',
  'kids',
  'cycling',
  'mind_body',
] as const;
export type ActivityCategory = (typeof activityCategories)[number];

export type ClassLevel = 'all_levels' | 'beginner' | 'intermediate' | 'advanced';

export type Coach = {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  activityIds: string[];
};

export type Activity = {
  id: string;
  slug: string;
  name: string;
  category: ActivityCategory;
  shortDescription: string | null;
  description: string | null;
  /** 1–5 */
  intensity: number | null;
  equipment: string[];
  targetMuscles: string[];
  recommendedFor: string | null;
  durationMin: number | null;
  imageUrl: string | null;
  isFeatured: boolean;
  coachIds: string[];
};

export type ActivityRef = Pick<Activity, 'id' | 'slug' | 'name' | 'category' | 'imageUrl'>;
export type CoachRef = Pick<Coach, 'id' | 'slug' | 'displayName' | 'photoUrl'>;

/** A dated class in club-local wall-clock time. Information only — no booking. */
export type ClassSession = {
  id: string;
  date: ClubDate;
  startTime: ClubTime;
  endTime: ClubTime;
  activity: ActivityRef;
  coach: CoachRef | null;
  room: string | null;
  level: ClassLevel;
  /** Session-specific note; falls back to the activity description. */
  description: string | null;
  isCancelled: boolean;
};

export const newsCategories = [
  'announcement',
  'equipment',
  'offer',
  'event',
  'kids',
  'challenge',
  'schedule',
  'wellness',
] as const;
export type NewsCategory = (typeof newsCategories)[number];

export type NewsArticle = {
  id: string;
  slug: string;
  category: NewsCategory;
  title: string;
  excerpt: string;
  body: string;
  coverUrl: string | null;
  /** ISO 8601 instant */
  publishedAt: string;
};

export type Membership = {
  planName: string;
  status: 'active' | 'expired' | 'suspended';
  endsOn: ClubDate | null;
};

export type MemberProfile = {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  membership: Membership | null;
};

export type GuestInvitationStatus = 'sent' | 'activated' | 'used' | 'expired' | 'cancelled' | 'converted';



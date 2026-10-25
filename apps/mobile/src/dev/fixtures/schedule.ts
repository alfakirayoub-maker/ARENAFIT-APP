/**
 * DEVELOPMENT FIXTURES — mock weekly schedule, not the real Arena Fit planning.
 * Only real coach ↔ class pairings are used; days, times, rooms and levels are
 * invented. Mirrors supabase/fixtures/dev.sql.
 */

import { addDays, startOfWeek, type ClubDate } from '@/lib/club-time';
import type { ClassLevel, ClassSession } from '@/types/domain';

import { fixtureActivities, fixtureCoaches } from './catalogue';

type Slot = [dayOffset: number, start: string, end: string, activity: string, coach: string, room: string, level: ClassLevel];

const ROOM = {
  cycling: 'Studio Cycling (démo)',
  fitness: 'Studio Fitness (démo)',
  combat: 'Studio Combat (démo)',
  mind: 'Studio Mind & Body (démo)',
};

const weeklyTemplate: Slot[] = [
  [0, '07:00', '07:45', 'rpm', 'anas-d', ROOM.cycling, 'all_levels'],
  [0, '12:30', '13:15', 'body-pump', 'anas-l', ROOM.fitness, 'all_levels'],
  [0, '18:00', '19:00', 'rpm', 'anas-d', ROOM.cycling, 'all_levels'],
  [0, '19:15', '20:15', 'body-combat', 'abdellah', ROOM.combat, 'intermediate'],
  [1, '09:00', '09:45', 'mobility', 'hamza', ROOM.mind, 'all_levels'],
  [1, '18:30', '19:30', 'body-pump', 'yousra', ROOM.fitness, 'all_levels'],
  [1, '19:45', '20:30', 'arenas-synergy', 'ali', ROOM.fitness, 'intermediate'],
  [2, '07:00', '07:30', 'sprint', 'hamza', ROOM.cycling, 'advanced'],
  [2, '18:00', '19:00', 'body-attack', 'badr', ROOM.fitness, 'intermediate'],
  [2, '19:15', '20:00', 'rpm-mixte', 'anas-d', ROOM.cycling, 'all_levels'],
  [3, '12:30', '13:00', 'core', 'anas-l', ROOM.fitness, 'all_levels'],
  [3, '18:30', '19:30', 'body-combat', 'hamza', ROOM.combat, 'all_levels'],
  [3, '19:45', '20:30', 'arena-500', 'ali', ROOM.fitness, 'advanced'],
  [4, '18:00', '18:45', 'cardio-mix', 'abdellah', ROOM.fitness, 'all_levels'],
  [4, '19:00', '19:45', 'rpm', 'badr', ROOM.cycling, 'all_levels'],
  [5, '10:00', '11:00', 'body-pump', 'ali', ROOM.fitness, 'all_levels'],
  [5, '11:15', '12:15', 'biking-adventure', 'hamza', ROOM.cycling, 'all_levels'],
  [6, '10:30', '11:15', 'stretching', 'hamza', ROOM.mind, 'beginner'],
  [6, '17:00', '18:00', 'body-pump', 'badr', ROOM.fitness, 'all_levels'],
  [6, '18:30', '19:15', 'rpm', 'hamza', ROOM.cycling, 'all_levels'],
  [6, '19:30', '20:15', 'core-mobility', 'hamza', ROOM.mind, 'all_levels'],
];

/** Mock sessions for the week of `today` and the following week. */
export function buildFixtureSessions(today: ClubDate): ClassSession[] {
  const monday = startOfWeek(today);
  return [0, 7].flatMap((weekOffset) =>
    weeklyTemplate.flatMap(([day, start, end, activitySlug, coachSlug, room, level]) => {
      const activity = fixtureActivities.find((a) => a.slug === activitySlug);
      const coach = fixtureCoaches.find((c) => c.slug === coachSlug);
      // Guard: never pair a coach with a class they don't teach.
      if (!activity || !coach || !coach.activityIds.includes(activity.id)) return [];
      const date = addDays(monday, weekOffset + day);
      return [
        {
          id: `session-${date}-${start.replace(':', '')}-${activitySlug}`,
          date,
          startTime: start,
          endTime: end,
          activity: {
            id: activity.id,
            slug: activity.slug,
            name: activity.name,
            category: activity.category,
            imageUrl: activity.imageUrl,
          },
          coach: { id: coach.id, slug: coach.slug, displayName: coach.displayName, photoUrl: coach.photoUrl },
          room,
          level,
          description: null,
          isCancelled: false,
        },
      ];
    }),
  );
}

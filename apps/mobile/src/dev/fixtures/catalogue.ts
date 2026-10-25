/**
 * DEVELOPMENT FIXTURES — not Arena Fit facts.
 *
 * Real (from Arena Fit): coach names, activity names, coach ↔ activity pairings.
 * Mock (for UI development only): descriptions, durations, intensity,
 * equipment, featured flags. Club-specific formats deliberately keep `null`
 * descriptions so the UI is exercised with missing data, as it will be in
 * production until the admin fills them in.
 */

import type { Activity, ActivityCategory, Coach } from '@/types/domain';

type ActivitySeed = {
  slug: string;
  name: string;
  category: ActivityCategory;
  mock?: Partial<Omit<Activity, 'id' | 'slug' | 'name' | 'category' | 'coachIds'>>;
};

const activitySeeds: ActivitySeed[] = [
  {
    slug: 'body-pump',
    name: 'Body Pump',
    category: 'fitness',
    mock: {
      shortDescription: 'Renforcement musculaire avec barre et poids, en musique.',
      description:
        'Un entraînement complet avec barre et disques : des répétitions nombreuses à charge légère à modérée pour tonifier tout le corps. Vous choisissez votre charge, le coach donne le rythme.',
      intensity: 3,
      equipment: ['Barre', 'Disques', 'Step'],
      targetMuscles: ['Corps entier'],
      recommendedFor: 'Tous les membres souhaitant se renforcer',
      durationMin: 60,
      isFeatured: true,
    },
  },
  {
    slug: 'rpm',
    name: 'RPM',
    category: 'cycling',
    mock: {
      shortDescription: 'Cardio sur vélo indoor, rythmé par la musique.',
      description:
        'Un parcours sur vélo indoor alternant montées, sprints et récupérations. Vous contrôlez la résistance : idéal pour progresser en endurance à votre niveau.',
      intensity: 4,
      equipment: ['Vélo indoor'],
      targetMuscles: ['Jambes', 'Fessiers', 'Cardio'],
      recommendedFor: 'Tous niveaux, résistance ajustable',
      durationMin: 45,
      isFeatured: true,
    },
  },
  {
    slug: 'body-combat',
    name: 'Body Combat',
    category: 'combat',
    mock: {
      shortDescription: 'Cardio inspiré des arts martiaux, sans contact.',
      description:
        'Coups de poing, coups de pied et katas inspirés de la boxe, du karaté et du taekwondo. Un défoulement cardio intense, sans contact ni matériel.',
      intensity: 4,
      equipment: [],
      targetMuscles: ['Cardio', 'Abdominaux', 'Épaules'],
      recommendedFor: 'Celles et ceux qui veulent se dépasser',
      durationMin: 55,
      isFeatured: true,
    },
  },
  {
    slug: 'body-attack',
    name: 'Body Attack',
    category: 'fitness',
    mock: {
      shortDescription: 'Cardio athlétique et renforcement.',
      description: 'Un mélange de mouvements athlétiques, de sauts et d’exercices de renforcement pour un cardio complet.',
      intensity: 5,
      targetMuscles: ['Cardio', 'Jambes'],
      durationMin: 55,
    },
  },
  { slug: 'arenas-synergy', name: "Arena's Synergy", category: 'fitness', mock: { isFeatured: true } },
  { slug: 'arena-500', name: 'Arena 500', category: 'fitness' },
  {
    slug: 'sprint',
    name: 'Sprint',
    category: 'cycling',
    mock: {
      shortDescription: 'HIIT court et intense sur vélo.',
      description: 'Des efforts très courts à haute intensité sur vélo, entrecoupés de récupérations. Court, mais exigeant.',
      intensity: 5,
      equipment: ['Vélo indoor'],
      durationMin: 30,
    },
  },
  { slug: 'sprint-core', name: 'Sprint-Core', category: 'cycling' },
  {
    slug: 'core',
    name: 'Core',
    category: 'fitness',
    mock: {
      shortDescription: 'Gainage et sangle abdominale.',
      description: 'Un format court pour renforcer la sangle abdominale, le dos et la stabilité.',
      intensity: 3,
      targetMuscles: ['Abdominaux', 'Dos'],
      durationMin: 30,
    },
  },
  { slug: 'core-mobility', name: 'Core / Mobility', category: 'mind_body' },
  {
    slug: 'mobility',
    name: 'Mobility',
    category: 'mind_body',
    mock: {
      shortDescription: 'Amplitude articulaire et récupération.',
      description: 'Des exercices guidés pour gagner en amplitude, prévenir les blessures et mieux récupérer.',
      intensity: 1,
      recommendedFor: 'Tous, en complément des cours intenses',
      durationMin: 45,
    },
  },
  {
    slug: 'stretching',
    name: 'Stretching',
    category: 'mind_body',
    mock: {
      shortDescription: 'Étirements doux et relâchement.',
      description: 'Une séance calme d’étirements pour relâcher les tensions et améliorer la souplesse.',
      intensity: 1,
      durationMin: 45,
    },
  },
  { slug: 'full-legs', name: 'Full Legs', category: 'fitness' },
  { slug: 'grit-force', name: 'Grit Force', category: 'fitness' },
  { slug: 'rpm-mixte', name: 'RPM Mixte', category: 'cycling' },
  { slug: 'circuit-training', name: 'Circuit Training', category: 'fitness' },
  { slug: 'fitness-challenge', name: 'Fitness Challenge', category: 'fitness' },
  { slug: 'cardio-mix', name: 'Cardio Mix', category: 'fitness' },
  { slug: 'biking-adventure', name: 'Biking Adventure', category: 'cycling' },
];

/** Real roster: coach → classes, exactly as supplied by Arena Fit. */
const roster: { slug: string; displayName: string; classes: string[] }[] = [
  { slug: 'anas-l', displayName: 'ANAS L', classes: ['body-pump', 'full-legs', 'core', 'grit-force'] },
  { slug: 'anas-d', displayName: 'ANAS D', classes: ['rpm-mixte', 'circuit-training', 'fitness-challenge', 'rpm'] },
  { slug: 'abdellah', displayName: 'ABDELLAH', classes: ['cardio-mix', 'body-pump', 'body-attack', 'body-combat'] },
  { slug: 'badr', displayName: 'BADR', classes: ['rpm', 'body-pump', 'body-attack', 'body-combat'] },
  {
    slug: 'hamza',
    displayName: 'HAMZA',
    classes: ['stretching', 'mobility', 'core-mobility', 'sprint', 'sprint-core', 'biking-adventure', 'body-combat', 'rpm'],
  },
  { slug: 'ali', displayName: 'ALI', classes: ['arenas-synergy', 'body-pump', 'arena-500'] },
  { slug: 'yousra', displayName: 'YOUSRA', classes: ['body-pump'] },
];

export const fixtureCoaches: Coach[] = roster.map((c) => ({
  id: `coach-${c.slug}`,
  slug: c.slug,
  displayName: c.displayName,
  bio: null,
  photoUrl: null,
  activityIds: c.classes.map((slug) => `activity-${slug}`),
}));

export const fixtureActivities: Activity[] = activitySeeds.map((a) => ({
  id: `activity-${a.slug}`,
  slug: a.slug,
  name: a.name,
  category: a.category,
  shortDescription: null,
  description: null,
  intensity: null,
  equipment: [],
  targetMuscles: [],
  recommendedFor: null,
  durationMin: null,
  imageUrl: null,
  isFeatured: false,
  ...a.mock,
  coachIds: roster.filter((c) => c.classes.includes(a.slug)).map((c) => `coach-${c.slug}`),
}));

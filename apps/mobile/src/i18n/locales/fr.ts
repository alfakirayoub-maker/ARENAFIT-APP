/**
 * French is the source locale: its shape defines the translation keys.
 * Other locales must implement the same shape (enforced by `Translation`).
 */
const fr = {
  common: {
    seeAll: 'Voir tout',
    retry: 'Réessayer',
    close: 'Fermer',
    back: 'Retour',
    loading: 'Chargement…',
  },
  tabs: {
    home: 'Accueil',
    planning: 'Planning',
    activities: 'Activités',
    news: 'Actualités',
    profile: 'Profil',
  },
  home: {
    greeting: 'Bonjour, {{name}}',
    greetingAnonymous: 'Bonjour',
    nextClass: 'Prochain cours',
    todaySchedule: 'Planning du jour',
    favoriteActivities: 'Mes activités favorites',
  },
  planning: {
    title: 'Planning',
    subtitle: 'Tous les cours de la semaine',
  },
  activities: {
    title: 'Activités',
    subtitle: 'Découvrez les programmes Arena Fit',
  },
  news: {
    title: 'Actualités',
    subtitle: 'La vie du club',
  },
  profile: {
    title: 'Profil',
  },
  reminder: {
    cta: 'Me le rappeler',
    set: 'Rappel activé',
  },
  guestPass: {
    offer: 'Offrir un Pass',
    guestMode: 'Mode Invité',
  },
  categories: {
    all: 'Tous',
    fitness: 'Fitness',
    combat: 'Combat',
    dance: 'Dance',
    aqua: 'Aqua',
    kids: 'Kids',
    cycling: 'Cycling',
    mind_body: 'Mind & Body',
  },
  levels: {
    all_levels: 'Tous niveaux',
    beginner: 'Débutant',
    intermediate: 'Intermédiaire',
    advanced: 'Avancé',
  },
  empty: {
    noClassesToday: {
      title: 'Aucun cours aujourd’hui',
      body: 'Profitez-en pour récupérer, ou consultez le planning de la semaine.',
    },
    noNews: {
      title: 'Aucune actualité',
      body: 'Les nouvelles du club apparaîtront ici.',
    },
    noFavorites: {
      title: 'Aucune activité favorite',
      body: 'Ajoutez vos activités préférées pour les retrouver rapidement.',
    },
    noInvitations: {
      title: 'Aucune invitation',
      body: 'Offrez un Pass à un proche pour lui faire découvrir Arena Fit.',
    },
    comingSoon: {
      title: 'Bientôt disponible',
      body: 'Cet écran arrive dans la prochaine version.',
    },
  },
  errors: {
    generic: 'Une erreur est survenue.',
    notFound: 'Page introuvable',
  },
  a11y: {
    logo: 'Arena Fit',
  },
} as const;

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };
export type Translation = DeepString<typeof fr>;

export default fr;

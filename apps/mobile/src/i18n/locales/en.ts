import type { Translation } from './fr';

const en: Translation = {
  common: {
    seeAll: 'See all',
    retry: 'Try again',
    close: 'Close',
    back: 'Back',
    loading: 'Loading…',
  },
  tabs: {
    home: 'Home',
    planning: 'Schedule',
    activities: 'Activities',
    news: 'News',
    profile: 'Profile',
  },
  home: {
    greeting: 'Hello, {{name}}',
    greetingAnonymous: 'Hello',
    nextClass: 'Next class',
    todaySchedule: 'Today’s schedule',
    favoriteActivities: 'My favorite activities',
  },
  planning: {
    title: 'Schedule',
    subtitle: 'All classes this week',
  },
  activities: {
    title: 'Activities',
    subtitle: 'Discover Arena Fit programs',
  },
  news: {
    title: 'News',
    subtitle: 'Life at the club',
  },
  profile: {
    title: 'Profile',
  },
  reminder: {
    cta: 'Remind me',
    set: 'Reminder set',
  },
  guestPass: {
    offer: 'Give a Pass',
    guestMode: 'Guest mode',
  },
  categories: {
    all: 'All',
    fitness: 'Fitness',
    combat: 'Combat',
    dance: 'Dance',
    aqua: 'Aqua',
    kids: 'Kids',
    cycling: 'Cycling',
    mind_body: 'Mind & Body',
  },
  levels: {
    all_levels: 'All levels',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  },
  empty: {
    noClassesToday: {
      title: 'No classes today',
      body: 'Take time to recover, or check this week’s schedule.',
    },
    noNews: {
      title: 'No news yet',
      body: 'Club news will appear here.',
    },
    noFavorites: {
      title: 'No favorite activities',
      body: 'Add your favorite activities to find them quickly.',
    },
    noInvitations: {
      title: 'No invitations yet',
      body: 'Give a Pass to someone close to discover Arena Fit.',
    },
    comingSoon: {
      title: 'Coming soon',
      body: 'This screen arrives in the next version.',
    },
  },
  errors: {
    generic: 'Something went wrong.',
    notFound: 'Page not found',
  },
  a11y: {
    logo: 'Arena Fit',
  },
};

export default en;

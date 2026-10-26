import type { Tone } from '@/components/ui';

export const LEVEL_LABEL = {
  all_levels: 'Tous niveaux',
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
} as const;

export const VISIBILITY_LABEL = {
  public: 'Public',
  members: 'Membres uniquement',
  hidden: 'Masqué',
} as const;

export const CATEGORY_LABEL = {
  fitness: 'Fitness',
  combat: 'Combat',
  dance: 'Danse',
  aqua: 'Aqua',
  kids: 'Kids',
  cycling: 'Cycling',
  mind_body: 'Mind & Body',
} as const;

export const NEWS_CATEGORY_LABEL = {
  announcement: 'Annonce',
  equipment: 'Équipement',
  offer: 'Offre',
  event: 'Événement',
  kids: 'Kids',
  challenge: 'Challenge',
  schedule: 'Planning',
  wellness: 'Bien-être',
} as const;

export const NOTIFICATION_CATEGORY_LABEL = {
  schedule_change: 'Cours & planning',
  club_news: 'Actualités',
  event: 'Offres & événements',
  announcement: 'Annonce importante du club',
} as const;

export const INVITATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  sent: { label: 'Envoyée', tone: 'warning' },
  activated: { label: 'Pass activé', tone: 'accent' },
  used: { label: 'Utilisé', tone: 'success' },
  expired: { label: 'Expirée', tone: 'neutral' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
  converted: { label: 'Devenu membre', tone: 'success' },
};

export const EVENT_LABEL: Record<string, string> = {
  gift_created: 'Invitation créée',
  gift_shared: 'Invitation partagée',
  link_rotated: 'Nouveau lien généré',
  invitation_opened: 'Invitation ouverte',
  gift_activated: 'Pass activé',
  gift_cancelled: 'Invitation annulée',
  gift_expired: 'Invitation expirée',
  reception_qr_scanned: 'QR réception scanné',
  guest_pass_redeemed: 'Pass utilisé à l’accueil',
};

export const OUTCOME_LABEL: Record<string, string> = {
  success: 'validé',
  invalid_format: 'QR invalide',
  invalid_station: 'station inconnue',
  inactive_station: 'station désactivée',
  no_pass: 'aucun Pass',
  expired: 'Pass expiré',
  already_used: 'déjà utilisé',
};

export const NEWS_STATE_BADGE: Record<'draft' | 'scheduled' | 'published', { label: string; tone: 'neutral' | 'warning' | 'success' }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  scheduled: { label: 'Programmée', tone: 'warning' },
  published: { label: 'Publiée', tone: 'success' },
};

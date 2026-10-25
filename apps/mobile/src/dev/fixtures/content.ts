/**
 * DEVELOPMENT FIXTURES — mock news, member and invitations. Not Arena Fit facts.
 * The member card and invitation names reuse the examples from the product brief.
 */

import type { GuestPassSummary, MemberProfile, NewsArticle } from '@/types/domain';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export const fixtureNews: NewsArticle[] = [
  {
    id: 'news-1',
    slug: 'planning-semaine',
    category: 'schedule',
    title: 'Le planning de la semaine est en ligne',
    excerpt: 'Retrouvez tous les cours collectifs et activez vos rappels en un geste.',
    body:
      'Le planning des cours collectifs est disponible dans l’onglet Planning.\n\nAppuyez sur la cloche d’un cours pour recevoir un rappel avant qu’il ne commence. Un rappel n’est pas une réservation.',
    coverUrl: null,
    publishedAt: daysAgo(1),
  },
  {
    id: 'news-2',
    slug: 'challenge-novembre',
    category: 'challenge',
    title: 'Challenge du mois : 12 cours en 4 semaines',
    excerpt: 'Relevez le défi et partagez votre progression avec l’équipe des coachs.',
    body:
      'Ce mois-ci, nous vous proposons de suivre 12 cours collectifs en 4 semaines.\n\nChoisissez les formats qui vous plaisent et parlez-en à vos coachs en salle.',
    coverUrl: null,
    publishedAt: daysAgo(3),
  },
  {
    id: 'news-3',
    slug: 'recuperation-mobility',
    category: 'wellness',
    title: 'Récupérer mieux grâce aux cours Mobility',
    excerpt: 'Pourquoi intégrer une séance douce à votre semaine d’entraînement.',
    body:
      'Les séances de mobilité et d’étirements aident à garder de l’amplitude et à récupérer entre deux séances intenses.\n\nUne séance par semaine suffit pour en ressentir les bénéfices.',
    coverUrl: null,
    publishedAt: daysAgo(6),
  },
  {
    id: 'news-4',
    slug: 'evenement-portes-ouvertes',
    category: 'event',
    title: 'Journée découverte au club',
    excerpt: 'Invitez vos proches à découvrir les cours collectifs avec un Pass Invité.',
    body:
      'Profitez de vos Pass Invité pour faire découvrir Arena Fit à vos proches.\n\nDepuis l’onglet Profil, ouvrez Pass & Invitations et partagez votre invitation.',
    coverUrl: null,
    publishedAt: daysAgo(10),
  },
];

export const fixtureMember: MemberProfile = {
  firstName: 'Ayoub',
  lastName: 'A.',
  avatarUrl: null,
  membership: { planName: 'Arena Premium', status: 'active', endsOn: '2027-08-24' },
};

export const fixtureGuestPasses: GuestPassSummary = {
  allowance: 3,
  available: 2,
  invitations: [
    { id: 'inv-1', inviteeName: 'Yassine', status: 'sent', createdAt: daysAgo(1) },
    { id: 'inv-2', inviteeName: 'Sara', status: 'activated', createdAt: daysAgo(4) },
    { id: 'inv-3', inviteeName: 'Mehdi', status: 'used', createdAt: daysAgo(12) },
    { id: 'inv-4', inviteeName: 'Imane', status: 'converted', createdAt: daysAgo(30) },
  ],
};

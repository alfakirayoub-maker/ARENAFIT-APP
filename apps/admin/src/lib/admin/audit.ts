import { z } from 'zod';

import { runParsed, type Db } from './core';

const entry = z.object({
  id: z.number(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  summary: z.record(z.string(), z.unknown()),
  actor: z.string().nullable(),
  actor_role: z.string().nullable(),
  created_at: z.string(),
});
export type AuditEntry = z.output<typeof entry>;

export const listAudit = (db: Db, entityId?: string) =>
  runParsed(z.array(entry), db.rpc('admin_list_audit_log', { p_limit: 200, p_entity_id: entityId ?? null }));

export const AUDIT_LABEL: Record<string, string> = {
  'session.created': 'Cours créé',
  'session.updated': 'Cours modifié',
  'session.cancelled': 'Cours annulé',
  'session.restored': 'Cours rétabli',
  'session.deleted': 'Cours supprimé',
  'session.duplicated': 'Cours dupliqué',
  'news.created': 'Actualité créée',
  'news.updated': 'Actualité modifiée',
  'news.published': 'Actualité publiée',
  'news.unpublished': 'Actualité dépubliée',
  'news.deleted': 'Actualité supprimée',
  'coach.created': 'Coach créé',
  'coach.updated': 'Coach modifié',
  'coach.deactivated': 'Coach désactivé',
  'coach.reactivated': 'Coach réactivé',
  'coach.activities_updated': 'Activités du coach modifiées',
  'activity.created': 'Activité créée',
  'activity.updated': 'Activité modifiée',
  'activity.deactivated': 'Activité désactivée',
  'activity.reactivated': 'Activité réactivée',
  'station.created': 'Station créée',
  'station.rotated': 'QR de station renouvelé',
  'station.deactivated': 'Station désactivée',
  'station.reactivated': 'Station réactivée',
  'station.renamed': 'Station renommée',
  'invitation.cancelled': 'Invitation annulée',
};

const FIELD_LABEL: Record<string, string> = {
  session_date: 'date',
  start_time: 'début',
  end_time: 'fin',
  activity_id: 'activité',
  coach_id: 'coach',
  room_id: 'salle',
  level: 'niveau',
  visibility: 'visibilité',
  description: 'description',
  image_path: 'image',
  cancellation_note: 'motif',
  title: 'titre',
  excerpt: 'description courte',
  body: 'texte',
  category: 'catégorie',
  cover_path: 'image',
  slug: 'identifiant',
  display_name: 'nom',
  name: 'nom',
  bio: 'présentation',
  photo_path: 'photo',
  sort_order: 'ordre',
  short_description: 'description courte',
  intensity: 'intensité',
  default_duration_min: 'durée',
  equipment: 'matériel',
  is_featured: 'mise en avant',
};

/** Changed fields of an update, in French (« début, fin »); null when none recorded. */
export function changedFields(summary: AuditEntry['summary']): string | null {
  const changed = Array.isArray(summary.changed) ? (summary.changed as string[]) : [];
  return changed.length ? [...new Set(changed.map((c) => FIELD_LABEL[c] ?? c))].join(', ') : null;
}

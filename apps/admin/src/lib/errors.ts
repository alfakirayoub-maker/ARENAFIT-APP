/** Errors shown to staff: always a French sentence, never a raw database error. */
export type AdminErrorKind = 'forbidden' | 'not_found' | 'conflict' | 'invalid' | 'network' | 'unknown';

export class AdminError extends Error {
  readonly kind: AdminErrorKind;
  constructor(kind: AdminErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AdminError';
    this.kind = kind;
  }
}

const MESSAGES: Record<AdminErrorKind, string> = {
  forbidden: 'Votre rôle ne permet pas cette action.',
  not_found: 'Élément introuvable. Il a peut-être été supprimé.',
  conflict: 'Cet élément existe déjà (identifiant déjà utilisé).',
  invalid: 'Certaines valeurs ne sont pas valides.',
  network: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
  unknown: 'Une erreur est survenue. Réessayez.',
};

export function messageFor(error: unknown): string {
  if (error instanceof AdminError) return error.message;
  return MESSAGES.unknown;
}

/** Maps a Supabase/PostgREST/Storage error to an AdminError. */
export function toAdminError(error: unknown): AdminError {
  if (error instanceof AdminError) return error;
  const e = error as { code?: string; status?: number; statusCode?: string | number; message?: string } | null;
  const code = e?.code ?? '';
  const status = Number(e?.status ?? e?.statusCode ?? 0);
  let kind: AdminErrorKind = 'unknown';
  if (code === '42501' || status === 401 || status === 403 || /row-level security|forbidden/i.test(e?.message ?? '')) kind = 'forbidden';
  else if (code === 'P0002' || code === 'PGRST116' || status === 404) kind = 'not_found';
  else if (code === '23505') kind = 'conflict';
  else if (['23514', '22023', '22P02', '23502', 'P0001', '22007', '22008'].includes(code) || status === 400 || status === 413 || status === 415) kind = 'invalid';
  else if (error instanceof TypeError || /fetch|network/i.test(e?.message ?? '')) kind = 'network';
  return new AdminError(kind, MESSAGES[kind], { cause: error });
}

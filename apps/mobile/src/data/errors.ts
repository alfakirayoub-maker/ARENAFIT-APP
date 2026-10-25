/**
 * Errors surfaced by repositories. Screens never inspect Supabase/PostgREST
 * errors directly; they only see these kinds (and render ErrorState).
 */
export type DataErrorKind =
  /** No connectivity, timeout, DNS… — worth retrying. */
  | 'network'
  /** 5xx or unexpected server failure — worth retrying. */
  | 'server'
  /** 4xx: bad request, missing permission (RLS), invalid key — retrying won't help. */
  | 'rejected'
  /** The response did not match the expected shape (schema drift). */
  | 'invalid-data'
  /** The app has no data source configured. */
  | 'config';

export class DataError extends Error {
  readonly kind: DataErrorKind;

  constructor(kind: DataErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataError';
    this.kind = kind;
  }

  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'server';
  }
}

export function isRetryable(error: unknown): boolean {
  return error instanceof DataError ? error.retryable : true;
}

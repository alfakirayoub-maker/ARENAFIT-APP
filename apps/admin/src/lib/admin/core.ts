import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';

import { AdminError, toAdminError } from '../errors';

export type Db = SupabaseClient;

type Result<T> = { data: T | null; error: PostgrestError | null };

/** Runs a query; maps failures to AdminError. */
export async function run<T>(request: PromiseLike<Result<T>>): Promise<T> {
  let res: Result<T>;
  try {
    res = await request;
  } catch (cause) {
    throw toAdminError(cause);
  }
  if (res.error) throw toAdminError(res.error);
  return res.data as T;
}

/** Runs a query and validates the JSON it returns (RPCs). */
export async function runParsed<S extends z.ZodType>(schema: S, request: PromiseLike<Result<unknown>>): Promise<z.output<S>> {
  const data = await run(request);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AdminError('unknown', 'Réponse inattendue du serveur.', { cause: parsed.error });
  return parsed.data;
}

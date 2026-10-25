import { env } from '@/config/env';

import { DataError } from './errors';
import type { ContentRepository } from './repository';
import { createPublicClient } from './supabase/client';
import { createSupabaseRepository } from './supabase/repository';

export type DataSource = 'supabase' | 'fixtures' | 'unconfigured';

/**
 * Which repository backs the app:
 *  - Supabase whenever EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are set;
 *  - development fixtures in dev builds without Supabase config, or when
 *    EXPO_PUBLIC_DATA_SOURCE=fixtures (dev only);
 *  - release builds without config: every request fails with a `config`
 *    DataError (error states), never silently showing mock data.
 */
function resolveDataSource(): DataSource {
  if (__DEV__ && env.dataSource === 'fixtures') return 'fixtures';
  if (env.supabaseUrl && env.supabaseAnonKey) return 'supabase';
  return __DEV__ ? 'fixtures' : 'unconfigured';
}

const unconfigured = new Proxy({} as ContentRepository, {
  get: () => () => Promise.reject(new DataError('config', 'No data source configured')),
});

export const dataSource: DataSource = resolveDataSource();

/**
 * Development fixtures (mock data). The condition must be a pure build-time
 * constant: Metro then folds it and drops the require — and the fixtures —
 * from release bundles. Verified by grepping the exported bundle.
 */
const fixtureRepository: ContentRepository | null =
  process.env.NODE_ENV !== 'production'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- dev-only module, excluded from release bundles
      (require('./fixture-repository') as typeof import('./fixture-repository')).fixtureRepository
    : null;

export const repository: ContentRepository =
  dataSource === 'supabase'
    ? createSupabaseRepository(createPublicClient(env.supabaseUrl!, env.supabaseAnonKey!))
    : dataSource === 'fixtures' && fixtureRepository
      ? fixtureRepository
      : unconfigured;

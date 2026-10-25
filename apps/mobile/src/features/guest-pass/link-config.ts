import { env } from '@/config/env';

import type { LinkConfig } from './links';

export const linkConfig: LinkConfig = {
  branchDomain: env.branchDomain,
  branchAlternateDomain: env.branchAlternateDomain,
  inviteBaseUrl: env.inviteBaseUrl,
  scheme: 'arenafit',
};

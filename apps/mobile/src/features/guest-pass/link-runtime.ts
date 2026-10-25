import { env } from '@/config/env';

import { createBranchLinkService, createLocalLinkService, type BranchLike, type InvitationLinkService } from './link-service';
import { linkConfig } from './link-config';

/**
 * Native: Branch when its key and domain are configured (the config plugin is
 * then added by app.config.ts), else local links. react-native-branch is
 * required lazily so builds without Branch never load its native module.
 */
export const invitationLinks: InvitationLinkService =
  env.branchKey && env.branchDomain
    ? createBranchLinkService(
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only when Branch is configured
        (require('react-native-branch') as { default: BranchLike }).default,
        linkConfig,
      )
    : createLocalLinkService(linkConfig);

export { linkConfig };

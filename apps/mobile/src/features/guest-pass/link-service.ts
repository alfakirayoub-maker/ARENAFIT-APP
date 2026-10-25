import { buildInvitationUrl, parseBranchParams, type InvitationRef, type LinkConfig } from './links';

/**
 * Platform-independent invitation links. Screens build share URLs and receive
 * opened invitations through this interface; Expo Router stays the only
 * navigation source of truth (adapters never navigate themselves).
 */
export interface InvitationLinkService {
  readonly provider: 'branch' | 'local';
  buildShareUrl(shareToken: string): string;
  /**
   * Invitations delivered by the link provider, including the deferred case
   * (link tapped → store install → first open). Payloads are validated before
   * the callback runs.
   */
  subscribe(onInvitation: (ref: InvitationRef) => void): () => void;
}

/**
 * Dev / web / no-Branch adapter. Links are `${inviteBaseUrl}/invite/<token>`
 * or `arenafit://invite/<token>`; Expo Router opens them directly
 * (+native-intent validates them), so there is nothing to subscribe to and no
 * deferred deep linking.
 */
export function createLocalLinkService(config: LinkConfig): InvitationLinkService {
  return {
    provider: 'local',
    buildShareUrl: (token) => buildInvitationUrl(token, { ...config, branchDomain: null }),
    subscribe: () => () => {},
  };
}

/** The part of react-native-branch this adapter uses (lets tests pass a fake). */
export type BranchLike = {
  subscribe(options: {
    onOpenComplete: (event: { error?: string | null; params?: unknown }) => void;
  }): () => void;
};

/**
 * Branch adapter. Branch reports every app open; on the first open after an
 * install it returns the data of the link tapped before installing. Only
 * `af_invite` tokens from clicked Branch links are accepted (parseBranchParams);
 * no URL from the payload is ever opened or routed.
 */
export function createBranchLinkService(branch: BranchLike, config: LinkConfig): InvitationLinkService {
  if (!config.branchDomain) throw new Error('Branch domain missing');
  return {
    provider: 'branch',
    buildShareUrl: (token) => buildInvitationUrl(token, config),
    subscribe(onInvitation) {
      return branch.subscribe({
        onOpenComplete: ({ error, params }) => {
          if (error) return;
          const ref = parseBranchParams(params);
          if (ref) onInvitation(ref);
        },
      });
    },
  };
}

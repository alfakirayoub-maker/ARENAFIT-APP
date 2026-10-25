import { linkConfig } from '@/features/guest-pass/link-config';
import { resolveIncomingUrl } from '@/features/guest-pass/links';

/**
 * Every URL that opens the app (universal/app links, arenafit://) passes
 * through here before Expo Router sees it. Invitation links are validated and
 * rewritten to /invite/<token>; foreign or malformed URLs land on Accueil.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return resolveIncomingUrl(path, linkConfig);
  } catch {
    return '/';
  }
}

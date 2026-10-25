/**
 * Invitation links, short codes and QR payloads — pure functions, no platform
 * code. Everything that arrives from outside the app (deep links, Branch
 * payloads, typed codes) is validated here before it can reach navigation or
 * the server.
 */

/** Share and QR tokens: 32 random bytes, base64url without padding (server: private.random_token). */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
/** Short-code alphabet without look-alikes (server: private.random_code). */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_BODY_RE = new RegExp(`^AF[${CODE_ALPHABET}]{8}$`);

export type InvitationRef = { kind: 'token'; token: string } | { kind: 'code'; code: string };

export function isShareToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_RE.test(value);
}

/**
 * Canonical "AF-XXXX-XXXX" form of a typed code (any case, spaces, dashes),
 * or null when it cannot be a valid code. Mirrors private.normalize_code().
 */
export function normalizeShortCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = c.startsWith('AF') ? c : `AF${c}`;
  if (!CODE_BODY_RE.test(body)) return null;
  return `AF-${body.slice(2, 6)}-${body.slice(6, 10)}`;
}

export type LinkConfig = {
  /** Branch link domain (e.g. "arenafit.app.link"); null when Branch is not configured. */
  branchDomain: string | null;
  branchAlternateDomain: string | null;
  /** Public web base for invitation links when Branch is not used (dev / staging). */
  inviteBaseUrl: string | null;
  /** App URL scheme ("arenafit"). */
  scheme: string;
};

/** Query parameter carrying the share token in Branch links (becomes Branch link data). */
export const BRANCH_TOKEN_PARAM = 'af_invite';

/**
 * The link put in the share message. Branch long links carry their query
 * parameters as link data, so the token survives an App/Play Store install
 * (deferred deep linking) without creating links through an API.
 */
export function buildInvitationUrl(token: string, config: LinkConfig): string {
  if (!isShareToken(token)) throw new Error('Invalid share token');
  if (config.branchDomain) return `https://${config.branchDomain}/?${BRANCH_TOKEN_PARAM}=${token}`;
  if (config.inviteBaseUrl) return `${config.inviteBaseUrl.replace(/\/+$/, '')}/invite/${token}`;
  return `${config.scheme}://invite/${token}`;
}

export function buildShareMessage(url: string): string {
  return [
    '🎁 Je t’offre une séance chez Arena Fit.',
    'Découvre le club avec ton Pass Invité.',
    'Télécharge ou ouvre l’application Arena Fit pour activer ton cadeau :',
    url,
  ].join('\n');
}

/**
 * Invitation carried by a Branch session payload, or null. Payloads are
 * untrusted: only an object that came from a clicked Branch link and holds a
 * well-formed token is accepted. No URL from the payload is ever followed.
 */
export function parseBranchParams(params: unknown): InvitationRef | null {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
  const p = params as Record<string, unknown>;
  if (p['+clicked_branch_link'] !== true) return null;
  const token = p[BRANCH_TOKEN_PARAM];
  return isShareToken(token) ? { kind: 'token', token } : null;
}

function hostOf(domain: string | null): string | null {
  return domain ? domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase() : null;
}

/**
 * Maps an incoming URL (universal/app link, custom scheme) to an in-app path.
 *  - invitation links → "/invite/<token>"
 *  - Branch-domain links without a usable token → "/" (the Branch SDK
 *    delivers their payload separately)
 *  - other links on our scheme → their path, left to Expo Router (unknown
 *    paths render the not-found screen with a way home)
 *  - anything else (foreign hosts, javascript:, malformed) → "/"
 */
export function resolveIncomingUrl(raw: string, config: LinkConfig): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Already an app path (Expo Router passes those through too).
    return raw.startsWith('/') && !raw.startsWith('//') ? safeAppPath(raw) : '/';
  }

  const protocol = url.protocol.replace(/:$/, '').toLowerCase();
  if (protocol === config.scheme) {
    // arenafit://invite/<token> → host "invite", pathname "/<token>"
    const path = `/${url.host}${url.pathname}`.replace(/\/+$/, '') || '/';
    return safeAppPath(path);
  }
  if (protocol !== 'https') return '/';

  const host = url.host.toLowerCase();
  const branchHosts = [hostOf(config.branchDomain), hostOf(config.branchAlternateDomain)].filter(Boolean);
  if (branchHosts.includes(host)) {
    const token = url.searchParams.get(BRANCH_TOKEN_PARAM);
    return isShareToken(token) ? `/invite/${token}` : '/';
  }
  if (host === hostOf(config.inviteBaseUrl)) return safeAppPath(url.pathname);
  return '/';
}

/** Invitation paths are validated strictly; other paths keep only safe characters. */
function safeAppPath(path: string): string {
  const invite = /^\/invite\/([^/?#]+)\/?$/.exec(path);
  if (invite) return isShareToken(invite[1]) ? `/invite/${invite[1]}` : '/invite/invalid';
  return /^\/[A-Za-z0-9/_-]*$/.test(path) ? path : '/';
}

/**
 * QR content for a Guest Pass: an opaque, versioned token — no member or guest
 * data. Sprint 6's reception scanner parses it with parseGuestPassQr().
 */
export const QR_PREFIX = 'AFG1.';

export function buildGuestPassQr(qrToken: string): string {
  if (!isShareToken(qrToken)) throw new Error('Invalid QR token');
  return `${QR_PREFIX}${qrToken}`;
}

export function parseGuestPassQr(payload: string): string | null {
  if (!payload.startsWith(QR_PREFIX)) return null;
  const token = payload.slice(QR_PREFIX.length);
  return isShareToken(token) ? token : null;
}

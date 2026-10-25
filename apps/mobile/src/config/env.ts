/**
 * Public runtime configuration (EXPO_PUBLIC_* variables are inlined at build
 * time — never put secrets here). See apps/mobile/.env.example.
 */

function optional(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export const env = {
  /**
   * Public web base of invitation links when Branch is not configured
   * (`${inviteBaseUrl}/invite/<token>`), e.g. a staging web build. No
   * production domain is hardcoded anywhere.
   */
  inviteBaseUrl: optional(process.env.EXPO_PUBLIC_INVITE_BASE_URL),
  /** Branch live public key (key_live_…) — enables deferred deep linking in native builds. */
  branchKey: optional(process.env.EXPO_PUBLIC_BRANCH_KEY),
  /** Branch link domain, e.g. "arenafit.app.link" (invitation links use it when set). */
  branchDomain: optional(process.env.EXPO_PUBLIC_BRANCH_DOMAIN),
  /** Branch alternate link domain, e.g. "arenafit-alternate.app.link". */
  branchAlternateDomain: optional(process.env.EXPO_PUBLIC_BRANCH_ALTERNATE_DOMAIN),
  /** Supabase project (public URL + anon key only — never the service-role key). */
  supabaseUrl: optional(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: optional(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  /** Dev-only override: "fixtures" forces the mock repository. Ignored in release builds. */
  dataSource: optional(process.env.EXPO_PUBLIC_DATA_SOURCE),
} as const;


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
   * Base URL of shareable links, e.g. invitations: `${inviteBaseUrl}/invite/<token>`.
   * Points at the Branch link domain once the final Arena Fit domain exists.
   */
  inviteBaseUrl: optional(process.env.EXPO_PUBLIC_INVITE_BASE_URL),
  /** Branch public key (deferred deep linking for guest invitations, Sprint 5). */
  branchKey: optional(process.env.EXPO_PUBLIC_BRANCH_KEY),
  /** Supabase project (Sprint 3). */
  supabaseUrl: optional(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: optional(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
} as const;


import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { MemberProfile } from '@/types/domain';

const profileRow = z.object({
  kind: z.enum(['guest', 'member']),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
});

const membershipRow = z.object({
  plan_name: z.string(),
  status: z.enum(['active', 'expired', 'suspended']),
  ends_on: z.string().nullable(),
});

/**
 * The signed-in member's own profile and latest membership (RLS: own rows
 * only). Null when the user is not a member. Private avatars are not shown
 * yet (signed URLs come with the member account sprint).
 */
export async function loadMemberProfile(client: SupabaseClient, userId: string): Promise<MemberProfile | null> {
  const [profile, membership] = await Promise.all([
    client.from('profiles').select('kind, first_name, last_name').eq('id', userId).maybeSingle(),
    client
      .from('memberships')
      .select('plan_name, status, ends_on')
      .eq('profile_id', userId)
      .order('starts_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  const p = profileRow.safeParse(profile.data);
  if (!p.success || p.data.kind !== 'member') return null;
  const m = membershipRow.safeParse(membership.data);
  return {
    firstName: p.data.first_name ?? '',
    lastName: p.data.last_name ?? '',
    avatarUrl: null,
    membership: m.success ? { planName: m.data.plan_name, status: m.data.status, endsOn: m.data.ends_on } : null,
  };
}

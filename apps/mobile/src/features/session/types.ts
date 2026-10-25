import type { GuestPassSummary, MemberProfile } from '@/types/domain';

/**
 * Who is using the app.
 *
 *  - visitor: default. Browses planning, activities, coaches and news with no
 *    account and no Supabase user. Favorites/reminders live on the device.
 *  - guest:   holds an activated Guest Pass (Guest Pass sprint). Its Supabase
 *    identity is created at activation time, not before.
 *  - member:  signed-in club member. The activation / sign-in flow is not
 *    decided yet; only a development mock exists.
 */
export type Session =
  | { kind: 'visitor' }
  | { kind: 'guest'; firstName: string | null }
  | { kind: 'member'; member: MemberProfile; guestPasses: GuestPassSummary };

export type SessionKind = Session['kind'];

/**
 * The boundary between screens and authentication. The real member provider
 * (activation flow TBD) implements this interface; screens only use
 * `useSession()` and never know which provider is behind it.
 */
export interface AuthProvider {
  /** Session to start with (e.g. restored from secure storage). */
  restore(): Promise<Session>;
  signOut(): Promise<void>;
  /** Development only: preview the app as another kind of user. */
  mock?: (kind: SessionKind) => Session;
}

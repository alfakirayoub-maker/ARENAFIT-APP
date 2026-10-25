import type { MemberProfile } from '@/types/domain';

/**
 * Who is using the app.
 *
 *  - visitor: default. Browses planning, activities, coaches and news with no
 *    account and no Supabase user. Favorites/reminders live on the device.
 *  - guest:   holds the guest identity created when they tapped « Activer mon
 *    Pass » (anonymous Supabase user bound to their Guest Pass).
 *  - member:  signed-in club member. The member sign-in flow is not decided
 *    yet: release builds never create member sessions; development builds can
 *    sign in a test member or show a demo member (`demo: true`, fixture data,
 *    no backend).
 */
export type Session =
  | { kind: 'visitor' }
  | { kind: 'guest'; userId: string }
  | { kind: 'member'; member: MemberProfile; demo: boolean };

export type SessionKind = Session['kind'];

/** Development builds only: which session to preview. */
export type DevSessionChoice = 'visitor' | 'member-demo' | 'member-test';

/**
 * The boundary between screens and authentication. Screens only use
 * `useSession()` and never know which provider is behind it.
 */
export interface AuthProvider {
  /** Session to start with (restored from the persisted auth session). */
  restore(): Promise<Session>;
  signOut(): Promise<void>;
  /** Development only. */
  dev?: {
    choices: DevSessionChoice[];
    select(choice: DevSessionChoice): Promise<Session>;
  };
}

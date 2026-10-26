/**
 * Staff roles and what each one sees in the dashboard. This mirrors the
 * database rules (can_manage_content / can_view_guest_passes / is_admin) for
 * navigation and buttons only — the database is what actually enforces them.
 */
export type StaffRole = 'admin' | 'content_manager' | 'reception';

export type Capability =
  | 'dashboard'
  | 'planning'
  | 'coaches'
  | 'activities'
  | 'news'
  | 'notifications'
  | 'guestPasses'
  | 'guestPassCancel'
  | 'stations'
  | 'stationManage'
  | 'members'
  | 'audit';

const MATRIX: Record<Capability, readonly StaffRole[]> = {
  dashboard: ['admin', 'content_manager', 'reception'],
  planning: ['admin', 'content_manager'],
  coaches: ['admin', 'content_manager'],
  activities: ['admin', 'content_manager'],
  news: ['admin', 'content_manager'],
  notifications: ['admin', 'content_manager'],
  guestPasses: ['admin', 'reception'],
  guestPassCancel: ['admin'],
  stations: ['admin', 'reception'],
  stationManage: ['admin'],
  members: ['admin'],
  audit: ['admin'],
};

export function can(role: StaffRole | null | undefined, capability: Capability): boolean {
  return !!role && MATRIX[capability].includes(role);
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: 'Administrateur',
  content_manager: 'Responsable contenu',
  reception: 'Réception',
};

export function isStaffRole(value: unknown): value is StaffRole {
  return value === 'admin' || value === 'content_manager' || value === 'reception';
}

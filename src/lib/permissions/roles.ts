import type { UserRole } from '../../types/domain';

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  student: '/student/dashboard',
  clinician: '/clinician/dashboard',
  college_officer: '/college/dashboard',
  regional_officer: '/regional/dashboard',
  government_admin: '/government/dashboard',
  super_admin: '/superadmin/dashboard',
};

export function getDashboardForRole(role: UserRole | null | undefined): string {
  if (!role) return '/no-access';
  return ROLE_DASHBOARDS[role] || '/no-access';
}

/**
 * Which roles may enter each route tree.
 *
 * SECURITY (AUDIT.md H3): this table is DEFAULT-DENY.
 */
const ROUTE_TREES: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: '/student/',    roles: ['student'] },
  { prefix: '/clinician/',  roles: ['clinician'] },
  { prefix: '/college/',    roles: ['college_officer'] },
  { prefix: '/regional/',   roles: ['regional_officer', 'government_admin'] },
  { prefix: '/government/', roles: ['government_admin'] },
  { prefix: '/admin/',      roles: ['government_admin'] },
  { prefix: '/superadmin/', roles: ['super_admin'] },
];

export function isRouteAllowedForRole(pathname: string, role: UserRole | null | undefined): boolean {
  if (!role) return false;

  const tree = ROUTE_TREES.find((t) => pathname.startsWith(t.prefix));

  // Default-deny: an unrecognised protected path is refused, not allowed.
  if (!tree) return false;

  // super_admin is intentionally NOT a wildcard here. It reaches other trees
  // only where a tree lists it explicitly. See AUDIT.md M4 (separation of duty).
  return tree.roles.includes(role);
}

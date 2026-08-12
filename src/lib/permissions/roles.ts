import type { UserRole } from '../../types/domain';

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  student: '/student/dashboard',
  college_officer: '/college/dashboard',
  government_admin: '/admin/dashboard',
  super_admin: '/superadmin/dashboard',
};

export function getDashboardForRole(role: UserRole): string {
  return ROLE_DASHBOARDS[role] || '/login';
}

export function isRouteAllowedForRole(pathname: string, role: UserRole): boolean {
  if (pathname.startsWith('/student/')) {
    return role === 'student';
  }
  if (pathname.startsWith('/college/')) {
    return role === 'college_officer';
  }
  if (pathname.startsWith('/admin/')) {
    return role === 'government_admin';
  }
  if (pathname.startsWith('/superadmin/')) {
    return role === 'super_admin';
  }
  return true; // Public routes
}

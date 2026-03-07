import type { UserRole } from '@/types';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 4,
  dispatcher: 3,
  operator: 2,
  viewer: 1,
};

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function hasAnyRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/admin': ['admin'],
  '/simulation': ['admin', 'dispatcher'],
  '/fleet/new': ['admin'],
  '/alerts': ['admin', 'dispatcher', 'operator'],
};

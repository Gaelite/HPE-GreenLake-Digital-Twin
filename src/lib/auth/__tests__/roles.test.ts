import { ROLE_HIERARCHY, hasRole, hasAnyRole, ROUTE_PERMISSIONS } from '@/lib/auth/roles';
import type { UserRole } from '@/types';

describe('auth/roles', () => {
  // ---------------------------------------------------------------------------
  // ROLE_HIERARCHY
  // ---------------------------------------------------------------------------
  describe('ROLE_HIERARCHY', () => {
    it('assigns admin the highest value (4)', () => {
      expect(ROLE_HIERARCHY.admin).toBe(4);
    });

    it('assigns viewer the lowest value (1)', () => {
      expect(ROLE_HIERARCHY.viewer).toBe(1);
    });

    it('defines all four roles', () => {
      const expectedRoles: UserRole[] = ['admin', 'dispatcher', 'operator', 'viewer'];
      expect(Object.keys(ROLE_HIERARCHY).sort()).toEqual([...expectedRoles].sort());
    });

    it('maintains strict descending order: admin > dispatcher > operator > viewer', () => {
      expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.dispatcher);
      expect(ROLE_HIERARCHY.dispatcher).toBeGreaterThan(ROLE_HIERARCHY.operator);
      expect(ROLE_HIERARCHY.operator).toBeGreaterThan(ROLE_HIERARCHY.viewer);
    });
  });

  // ---------------------------------------------------------------------------
  // hasRole
  // ---------------------------------------------------------------------------
  describe('hasRole', () => {
    describe('admin privileges', () => {
      it('returns true when admin is checked against viewer', () => {
        expect(hasRole('admin', 'viewer')).toBe(true);
      });

      it('returns true when admin is checked against operator', () => {
        expect(hasRole('admin', 'operator')).toBe(true);
      });

      it('returns true when admin is checked against dispatcher', () => {
        expect(hasRole('admin', 'dispatcher')).toBe(true);
      });

      it('returns true when admin is checked against admin (same role)', () => {
        expect(hasRole('admin', 'admin')).toBe(true);
      });
    });

    describe('dispatcher privileges', () => {
      it('returns true when dispatcher is checked against operator', () => {
        expect(hasRole('dispatcher', 'operator')).toBe(true);
      });

      it('returns true when dispatcher is checked against viewer', () => {
        expect(hasRole('dispatcher', 'viewer')).toBe(true);
      });

      it('returns true when dispatcher is checked against dispatcher (same role)', () => {
        expect(hasRole('dispatcher', 'dispatcher')).toBe(true);
      });

      it('returns false when dispatcher is checked against admin', () => {
        expect(hasRole('dispatcher', 'admin')).toBe(false);
      });
    });

    describe('operator privileges', () => {
      it('returns true when operator is checked against viewer', () => {
        expect(hasRole('operator', 'viewer')).toBe(true);
      });

      it('returns true when operator is checked against operator (same role)', () => {
        expect(hasRole('operator', 'operator')).toBe(true);
      });

      it('returns false when operator is checked against dispatcher', () => {
        expect(hasRole('operator', 'dispatcher')).toBe(false);
      });

      it('returns false when operator is checked against admin', () => {
        expect(hasRole('operator', 'admin')).toBe(false);
      });
    });

    describe('viewer privileges', () => {
      it('returns true when viewer is checked against viewer (same role)', () => {
        expect(hasRole('viewer', 'viewer')).toBe(true);
      });

      it('returns false when viewer is checked against operator', () => {
        expect(hasRole('viewer', 'operator')).toBe(false);
      });

      it('returns false when viewer is checked against dispatcher', () => {
        expect(hasRole('viewer', 'dispatcher')).toBe(false);
      });

      it('returns false when viewer is checked against admin', () => {
        expect(hasRole('viewer', 'admin')).toBe(false);
      });
    });

    describe('same role always returns true', () => {
      const roles: UserRole[] = ['admin', 'dispatcher', 'operator', 'viewer'];

      it.each(roles)('returns true when %s is checked against itself', (role) => {
        expect(hasRole(role, role)).toBe(true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // hasAnyRole
  // ---------------------------------------------------------------------------
  describe('hasAnyRole', () => {
    it('returns true when the role is present in the allowed array', () => {
      expect(hasAnyRole('dispatcher', ['admin', 'dispatcher', 'operator'])).toBe(true);
    });

    it('returns false when the role is not present in the allowed array', () => {
      expect(hasAnyRole('viewer', ['admin', 'dispatcher'])).toBe(false);
    });

    it('returns true for a single-element array that matches', () => {
      expect(hasAnyRole('operator', ['operator'])).toBe(true);
    });

    it('returns false for a single-element array that does not match', () => {
      expect(hasAnyRole('viewer', ['admin'])).toBe(false);
    });

    it('returns false for an empty array', () => {
      expect(hasAnyRole('admin', [])).toBe(false);
    });

    it('returns true when every role is allowed', () => {
      const allRoles: UserRole[] = ['admin', 'dispatcher', 'operator', 'viewer'];
      allRoles.forEach((role) => {
        expect(hasAnyRole(role, allRoles)).toBe(true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // ROUTE_PERMISSIONS
  // ---------------------------------------------------------------------------
  describe('ROUTE_PERMISSIONS', () => {
    it('restricts /admin to admin only', () => {
      expect(ROUTE_PERMISSIONS['/admin']).toEqual(['admin']);
    });

    it('allows /simulation for admin and dispatcher', () => {
      expect(ROUTE_PERMISSIONS['/simulation']).toEqual(['admin', 'dispatcher']);
    });

    it('restricts /fleet/new to admin only', () => {
      expect(ROUTE_PERMISSIONS['/fleet/new']).toEqual(['admin']);
    });

    it('allows /alerts for admin, dispatcher, and operator', () => {
      expect(ROUTE_PERMISSIONS['/alerts']).toEqual(['admin', 'dispatcher', 'operator']);
    });

    it('does not include viewer in any route permission', () => {
      Object.values(ROUTE_PERMISSIONS).forEach((allowedRoles) => {
        expect(allowedRoles).not.toContain('viewer');
      });
    });
  });
});

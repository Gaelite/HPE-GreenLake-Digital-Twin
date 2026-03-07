import { NextResponse } from 'next/server';
import type { UserRole } from '@/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetUser = jest.fn();
const mockFrom = jest.fn();

const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

// Import AFTER mocks are declared so module resolution picks them up
import { requireAuth } from '@/lib/auth/api-auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fakeUser = { id: 'user-abc-123', email: 'operator@example.com' };

const fakeProfile = {
  id: 'user-abc-123',
  email: 'operator@example.com',
  full_name: 'Jane Operator',
  role: 'operator' as UserRole,
  avatar_url: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

/** Configure the Supabase chain: from().select().eq().single() */
function mockProfileQuery(profile: typeof fakeProfile | null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: profile, error: null }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('auth/api-auth — requireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 401 — No authenticated user
  // -------------------------------------------------------------------------
  describe('when no user is authenticated', () => {
    it('returns a 401 error response when getUser returns an error', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token'),
      });

      const result = await requireAuth();

      expect(result).toHaveProperty('error');
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Unauthorized' },
        { status: 401 },
      );
      expect(result.error).toEqual(
        expect.objectContaining({ status: 401 }),
      );
    });

    it('returns a 401 error response when user is null (no error object)', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await requireAuth();

      expect(result).toHaveProperty('error');
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Unauthorized' },
        { status: 401 },
      );
      expect(result.error).toEqual(
        expect.objectContaining({ status: 401 }),
      );
    });

    it('does not attempt to fetch a profile', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error('No session'),
      });

      await requireAuth();

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 404 — No profile found
  // -------------------------------------------------------------------------
  describe('when authenticated but profile is not found', () => {
    it('returns a 404 error response', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      });
      mockProfileQuery(null);

      const result = await requireAuth();

      expect(result).toHaveProperty('error');
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Profile not found' },
        { status: 404 },
      );
      expect(result.error).toEqual(
        expect.objectContaining({ status: 404 }),
      );
    });

    it('queries the profiles table with the correct user id', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      });
      const chain = mockProfileQuery(null);

      await requireAuth();

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.eq).toHaveBeenCalledWith('id', fakeUser.id);
      expect(chain.single).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 403 — Role not in requiredRoles
  // -------------------------------------------------------------------------
  describe('when user role is not in the required roles list', () => {
    it('returns a 403 error response', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      });
      mockProfileQuery(fakeProfile); // role = 'operator'

      const result = await requireAuth(['admin', 'dispatcher']);

      expect(result).toHaveProperty('error');
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Forbidden' },
        { status: 403 },
      );
      expect(result.error).toEqual(
        expect.objectContaining({ status: 403 }),
      );
    });

    it('returns 403 even for a single disallowed role', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      });
      mockProfileQuery(fakeProfile); // role = 'operator'

      const result = await requireAuth(['admin']);

      expect(result).toHaveProperty('error');
      expect(result.error).toEqual(
        expect.objectContaining({ status: 403 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Success — authorized with required roles
  // -------------------------------------------------------------------------
  describe('when user is authorized with matching required roles', () => {
    it('returns user, profile, and supabase client', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      });
      mockProfileQuery(fakeProfile);

      const result = await requireAuth(['operator', 'admin']);

      expect(result).not.toHaveProperty('error');
      expect(result).toEqual({
        user: fakeUser,
        profile: fakeProfile,
        supabase: mockSupabase,
      });
    });

    it('returns the exact user object from getUser', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      });
      mockProfileQuery(fakeProfile);

      const result = await requireAuth(['operator']);

      expect(result.user).toBe(fakeUser);
    });

    it('returns the exact profile object from the database', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      });
      mockProfileQuery(fakeProfile);

      const result = await requireAuth(['operator']);

      expect(result.profile).toBe(fakeProfile);
    });

    it('returns the supabase client instance', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      });
      mockProfileQuery(fakeProfile);

      const result = await requireAuth(['operator']);

      expect(result.supabase).toBe(mockSupabase);
    });
  });

  // -------------------------------------------------------------------------
  // Success — no requiredRoles (any authenticated user)
  // -------------------------------------------------------------------------
  describe('when no requiredRoles are specified', () => {
    it('returns success for any authenticated user with a profile', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      });
      mockProfileQuery(fakeProfile);

      const result = await requireAuth();

      expect(result).not.toHaveProperty('error');
      expect(result).toEqual({
        user: fakeUser,
        profile: fakeProfile,
        supabase: mockSupabase,
      });
    });

    it('returns success regardless of what role the profile has', async () => {
      const adminProfile = { ...fakeProfile, role: 'admin' as UserRole };
      mockGetUser.mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      });
      mockProfileQuery(adminProfile);

      const result = await requireAuth();

      expect(result).not.toHaveProperty('error');
      expect(result.profile).toBe(adminProfile);
    });

    it('returns success when called with undefined', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: fakeUser },
        error: null,
      });
      mockProfileQuery(fakeProfile);

      const result = await requireAuth(undefined);

      expect(result).not.toHaveProperty('error');
      expect(result).toEqual({
        user: fakeUser,
        profile: fakeProfile,
        supabase: mockSupabase,
      });
    });
  });
});

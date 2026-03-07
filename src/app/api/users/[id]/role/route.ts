import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import type { UserRole } from '@/types';

const VALID_ROLES: UserRole[] = ['admin', 'dispatcher', 'operator', 'viewer'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(['admin']);

  if ('error' in auth && auth.error) {
    return auth.error;
  }

  const { supabase } = auth;
  const { id } = await params;

  try {
    const body = await request.json();
    const { role } = body;

    if (!role || !VALID_ROLES.includes(role as UserRole)) {
      return NextResponse.json(
        {
          error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Check that the target user exists
    const { data: targetUser, error: fetchError } = await supabase!
      .from('profiles')
      .select('id, role')
      .eq('id', id)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update the role
    const { error: updateError } = await supabase!
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'User role updated successfully',
      userId: id,
      role,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

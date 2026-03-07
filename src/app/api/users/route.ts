import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';

export async function GET() {
  const auth = await requireAuth(['admin']);

  if ('error' in auth && auth.error) {
    return auth.error;
  }

  const { supabase } = auth;

  try {
    const { data: users, error } = await supabase!
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

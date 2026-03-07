import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth && auth.error) return auth.error;

  return NextResponse.json({ profile: auth.profile });
}

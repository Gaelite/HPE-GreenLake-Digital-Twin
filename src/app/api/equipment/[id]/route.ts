import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import type { EquipmentStatus } from '@/types';

const VALID_STATUSES: EquipmentStatus[] = ['operational', 'needs_repair', 'replaced', 'missing'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(['admin', 'dispatcher', 'operator']);
  if ('error' in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const { id } = await params;

  let body: { status?: EquipmentStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { status } = body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const updatePayload: Record<string, unknown> = {
    status,
    last_checked: new Date().toISOString(),
  };

  const { data, error } = await supabase!
    .from('vehicle_equipment')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update equipment', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import type { MaintenanceStatus } from '@/types';

const VALID_STATUSES: MaintenanceStatus[] = ['scheduled', 'in_progress', 'completed'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(['admin', 'dispatcher', 'operator']);
  if ('error' in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const { id } = await params;

  let body: { status?: MaintenanceStatus; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { status, notes } = body;

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const updatePayload: Record<string, unknown> = {};
  if (status) {
    updatePayload.status = status;
    if (status === 'completed') {
      updatePayload.completed_date = new Date().toISOString();
    }
  }
  if (notes !== undefined) {
    updatePayload.notes = notes;
  }

  const { data, error } = await supabase!
    .from('maintenance_records')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update maintenance record', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

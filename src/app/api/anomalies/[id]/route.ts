import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import type { AnomalyStatus } from '@/types';

/**
 * PATCH /api/anomalies/:id
 *
 * Update an anomaly's status (acknowledge or resolve).
 * When resolving, sets resolved_at to current timestamp.
 *
 * Request body:
 *  { status: 'acknowledged' | 'resolved' }
 *
 * Requires: admin, dispatcher, or operator role.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(['admin', 'dispatcher', 'operator']);
  if ('error' in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const { id } = await params;

  let body: { status?: AnomalyStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { status } = body;

  if (!status || !['acknowledged', 'resolved'].includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status. Must be "acknowledged" or "resolved".' },
      { status: 400 }
    );
  }

  // Build update payload
  const updatePayload: Record<string, unknown> = { status };
  if (status === 'resolved') {
    updatePayload.resolved_at = new Date().toISOString();
  }

  const { data, error } = await supabase!
    .from('anomalies')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update anomaly', details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Anomaly not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ data });
}

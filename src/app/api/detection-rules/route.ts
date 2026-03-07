import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import type { Severity, MetricType } from '@/types';

/**
 * GET /api/detection-rules
 *
 * List all detection rules, ordered by metric_type then severity.
 * Available to all authenticated users.
 */
export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const { data, error } = await supabase!
    .from('detection_rules')
    .select('*')
    .order('metric_type', { ascending: true })
    .order('severity', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch detection rules', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

/**
 * POST /api/detection-rules
 *
 * Create a new detection rule. Admin only.
 *
 * Request body:
 *  {
 *    metric_type: MetricType,
 *    min_value?: number | null,
 *    max_value?: number | null,
 *    severity: Severity,
 *    description: string,
 *    vehicle_type?: string | null,
 *    is_active?: boolean
 *  }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(['admin']);
  if ('error' in auth && auth.error) return auth.error;
  const { supabase } = auth;

  let body: {
    metric_type?: MetricType;
    min_value?: number | null;
    max_value?: number | null;
    severity?: Severity;
    description?: string;
    vehicle_type?: string | null;
    is_active?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body.metric_type || !body.severity || !body.description) {
    return NextResponse.json(
      { error: 'Missing required fields: metric_type, severity, description' },
      { status: 400 }
    );
  }

  if (!['info', 'warning', 'critical'].includes(body.severity)) {
    return NextResponse.json(
      { error: 'Invalid severity. Must be "info", "warning", or "critical".' },
      { status: 400 }
    );
  }

  const insertPayload = {
    metric_type: body.metric_type,
    min_value: body.min_value ?? null,
    max_value: body.max_value ?? null,
    severity: body.severity,
    description: body.description,
    vehicle_type: body.vehicle_type ?? null,
    is_active: body.is_active ?? true,
  };

  const { data, error } = await supabase!
    .from('detection_rules')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to create detection rule', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}

/**
 * PUT /api/detection-rules
 *
 * Update an existing detection rule. Admin only.
 *
 * Request body:
 *  {
 *    id: string,
 *    ...fields to update
 *  }
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(['admin']);
  if ('error' in auth && auth.error) return auth.error;
  const { supabase } = auth;

  let body: {
    id?: string;
    metric_type?: MetricType;
    min_value?: number | null;
    max_value?: number | null;
    severity?: Severity;
    description?: string;
    vehicle_type?: string | null;
    is_active?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body.id) {
    return NextResponse.json(
      { error: 'Missing required field: id' },
      { status: 400 }
    );
  }

  if (body.severity && !['info', 'warning', 'critical'].includes(body.severity)) {
    return NextResponse.json(
      { error: 'Invalid severity. Must be "info", "warning", or "critical".' },
      { status: 400 }
    );
  }

  const { id, ...updateFields } = body;

  const { data, error } = await supabase!
    .from('detection_rules')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update detection rule', details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Detection rule not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ data });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { generateAllInsights } from '@/lib/recommendation-engine';
import type { Severity } from '@/types';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth && auth.error) return auth.error;

  const { supabase } = auth as Exclude<typeof auth, { error: NextResponse }>;
  const { searchParams } = new URL(request.url);
  const severityFilter = searchParams.get('severity') as Severity | null;
  const statusFilter = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);

  try {
    // First, check for persisted insights in the database
    let dbQuery = supabase
      .from('insights')
      .select('*')
      .eq('is_dismissed', false)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false });

    if (severityFilter) {
      dbQuery = dbQuery.eq('severity', severityFilter);
    }

    if (statusFilter && ['active', 'acknowledged', 'resolved'].includes(statusFilter)) {
      dbQuery = dbQuery.eq('status', statusFilter);
    }

    dbQuery = dbQuery.limit(limit);

    const { data: existingInsights, error: insightsError } = await dbQuery;

    // If we have persisted insights, return them
    if (!insightsError && existingInsights && existingInsights.length > 0) {
      // Sort by severity then date
      const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      const sorted = existingInsights.sort(
        (a, b) =>
          (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99) ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const { count: unreadCount } = await supabase
        .from('insights')
        .select('id', { count: 'exact', head: true })
        .eq('is_dismissed', false)
        .neq('status', 'resolved')
        .is('read_at', null);

      return NextResponse.json({ insights: sorted, unreadCount: unreadCount ?? 0 });
    }

    // Otherwise, generate insights dynamically using the recommendation engine
    const [vehiclesRes, telemetryRes, anomaliesRes, eventsRes] = await Promise.all([
      supabase.from('vehicles').select('*'),
      supabase
        .from('telemetry_readings')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(5000),
      supabase
        .from('anomalies')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000),
      supabase
        .from('events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(2000),
    ]);

    const vehicles = vehiclesRes.data ?? [];
    const telemetry = telemetryRes.data ?? [];
    const anomalies = anomaliesRes.data ?? [];
    const events = eventsRes.data ?? [];

    let generatedInsights = generateAllInsights(vehicles, telemetry, anomalies, events);

    // Apply severity filter if provided
    if (severityFilter) {
      generatedInsights = generatedInsights.filter((i) => i.severity === severityFilter);
    }

    // Apply limit
    generatedInsights = generatedInsights.slice(0, limit);

    // Persist generated insights for future retrieval
    if (generatedInsights.length > 0) {
      const { error: insertError } = await supabase
        .from('insights')
        .upsert(generatedInsights, { onConflict: 'id' });

      if (insertError) {
        console.warn('Could not persist insights:', insertError.message);
      }
    }

    const { count: unreadCount } = await supabase
      .from('insights')
      .select('id', { count: 'exact', head: true })
      .eq('is_dismissed', false)
      .neq('status', 'resolved')
      .is('read_at', null);

    return NextResponse.json({ insights: generatedInsights, unreadCount: unreadCount ?? 0 });
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

// PATCH: update insight status (acknowledge, resolve, dismiss, markRead)
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth && auth.error) return auth.error;

  const { supabase } = auth as Exclude<typeof auth, { error: NextResponse }>;

  try {
    const body = await request.json();
    const { id, ids, action, status } = body;

    // Bulk mark-as-read
    if (action === 'markRead' && Array.isArray(ids) && ids.length > 0) {
      const { error } = await supabase
        .from('insights')
        .update({ read_at: new Date().toISOString() })
        .in('id', ids)
        .is('read_at', null);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing insight id' }, { status: 400 });
    }

    // Status update (acknowledge / resolve)
    if (status && ['acknowledged', 'resolved'].includes(status)) {
      const updatePayload: Record<string, unknown> = { status };
      if (status === 'resolved') {
        updatePayload.is_dismissed = true;
      }

      const { error } = await supabase
        .from('insights')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true, status });
    }

    // Legacy dismiss (backward compat)
    const { error } = await supabase
      .from('insights')
      .update({ is_dismissed: true, status: 'resolved' })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Insight update error:', error);
    return NextResponse.json(
      { error: 'Failed to update insight' },
      { status: 500 }
    );
  }
}

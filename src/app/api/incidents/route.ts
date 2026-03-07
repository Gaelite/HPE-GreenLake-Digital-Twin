import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/api-auth';
import type { IncidentType, Severity } from '@/types';

// GET — list active incidents (not resolved)
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: incidents, error } = await supabase
      .from('incidents')
      .select('*')
      .neq('status', 'resolved')
      .order('reported_at', { ascending: false });

    if (error) {
      console.error('Error fetching incidents:', error);
      return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
    }

    return NextResponse.json({ incidents: incidents ?? [] });
  } catch (err) {
    console.error('Unexpected error in GET /api/incidents:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — create a new incident (admin, dispatcher, operator)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(['admin', 'dispatcher', 'operator']);
    if ('error' in auth && auth.error) return auth.error;

    const body = await request.json();

    const {
      title,
      description,
      incident_type,
      severity,
      latitude,
      longitude,
    } = body as {
      title?: string;
      description?: string;
      incident_type?: IncidentType;
      severity?: Severity;
      latitude?: number;
      longitude?: number;
    };

    // Validation
    if (!title || !incident_type || !severity || latitude == null || longitude == null) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: title, incident_type, severity, latitude, longitude',
        },
        { status: 400 },
      );
    }

    const validTypes: IncidentType[] = [
      'fire',
      'medical',
      'crime',
      'accident',
      'natural_disaster',
    ];
    if (!validTypes.includes(incident_type)) {
      return NextResponse.json(
        { error: `Invalid incident_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const validSeverities: Severity[] = ['info', 'warning', 'critical'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 },
      );
    }

    const supabase = auth.supabase!;

    const { data: incident, error } = await supabase
      .from('incidents')
      .insert({
        title,
        description: description || '',
        incident_type,
        severity,
        latitude,
        longitude,
        status: 'reported',
        reported_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating incident:', error);
      return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 });
    }

    return NextResponse.json({ incident }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/incidents:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// src/app/api/ml/maintenance-risk/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';

const ML_SERVICE_URL = 'http://46.62.151.23:30080';
const METRICS = ['engine_temp', 'oil_pressure', 'fuel_level', 'battery_voltage', 'tire_pressure'];
const LOOKBACK = 40;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth && auth.error) return auth.error;

  const { supabase } = auth as Exclude<typeof auth, { error: NextResponse }>;

  try {
    const body = await request.json();
    const { vehicle_id } = body;

    if (!vehicle_id) {
      return NextResponse.json({ error: 'vehicle_id is required' }, { status: 400 });
    }

    // ── Traer últimas lecturas de Supabase ────────────────────
    const { data: telemetry, error } = await supabase
      .from('telemetry_readings')
      .select('metric_type, value, timestamp')
      .eq('vehicle_id', vehicle_id)
      .in('metric_type', METRICS)
      .order('timestamp', { ascending: false })
      .limit(LOOKBACK * METRICS.length * 2);

    if (error) throw error;

    // ── Construir ventana [40 × 5] ────────────────────────────
    const windows: Record<string, number[]> = {};
    for (const metric of METRICS) {
      windows[metric] = (telemetry ?? [])
        .filter((r) => r.metric_type === metric)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-LOOKBACK)
        .map((r) => r.value);
    }

    // Verificar que hay suficientes datos
    const minReadings = Math.min(...METRICS.map((m) => windows[m].length));
    if (minReadings < LOOKBACK) {
      return NextResponse.json({
        error: `Insufficient data — need ${LOOKBACK} readings per metric, found ${minReadings}`,
      }, { status: 422 });
    }

    // Armar telemetry_window como lista de objetos [40 items]
    const telemetry_window = Array.from({ length: LOOKBACK }, (_, i) => ({
      engine_temp:     windows['engine_temp'][i],
      oil_pressure:    windows['oil_pressure'][i],
      fuel_level:      windows['fuel_level'][i],
      battery_voltage: windows['battery_voltage'][i],
      tire_pressure:   windows['tire_pressure'][i],
    }));

    // ── Llamar al microservicio Python ────────────────────────
    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ vehicle_id, telemetry_window }),
    });

    if (!mlResponse.ok) {
      const detail = await mlResponse.json();
      throw new Error(detail?.detail ?? `ML service responded with ${mlResponse.status}`);
    }

    const data = await mlResponse.json();
    return NextResponse.json({ ...data, source: 'ml_service' });

  } catch (error) {
    console.error('ML maintenance risk error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute maintenance risk' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  checkTelemetryForAnomalies,
  calculateRiskScore,
} from '@/lib/anomaly-engine';
import type { TelemetryReading, Anomaly } from '@/types';

/**
 * POST /api/anomalies/check
 *
 * Accepts a telemetry reading, fetches applicable detection rules,
 * runs the anomaly engine, inserts any detected anomalies into the DB,
 * and recalculates the vehicle's risk_score.
 *
 * This endpoint is called after telemetry ingestion.
 *
 * Request body:
 *  { reading: TelemetryReading }
 *
 * Returns:
 *  { anomalies: Anomaly[], risk_score: number }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth && auth.error) return auth.error;
  const { supabase } = auth;

  let body: { reading?: TelemetryReading };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { reading } = body;

  if (!reading || !reading.vehicle_id || !reading.metric_type || reading.value === undefined) {
    return NextResponse.json(
      { error: 'Missing required fields: reading must include vehicle_id, metric_type, and value.' },
      { status: 400 }
    );
  }

  // --- Fetch vehicle type for rule matching ---
  const { data: vehicle, error: vehicleError } = await supabase!
    .from('vehicles')
    .select('id, type')
    .eq('id', reading.vehicle_id)
    .single();

  if (vehicleError || !vehicle) {
    return NextResponse.json(
      { error: 'Vehicle not found', details: vehicleError?.message },
      { status: 404 }
    );
  }

  // --- Fetch all active detection rules ---
  const { data: rules, error: rulesError } = await supabase!
    .from('detection_rules')
    .select('*')
    .eq('is_active', true);

  if (rulesError) {
    return NextResponse.json(
      { error: 'Failed to fetch detection rules', details: rulesError.message },
      { status: 500 }
    );
  }

  // --- Run anomaly engine ---
  const detectedAnomalies = checkTelemetryForAnomalies(
    reading,
    rules || [],
    vehicle.type
  );

  let insertedAnomalies: Anomaly[] = [];

  // --- Insert detected anomalies ---
  if (detectedAnomalies.length > 0) {
    const { data: inserted, error: insertError } = await supabase!
      .from('anomalies')
      .insert(detectedAnomalies)
      .select();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to insert anomalies', details: insertError.message },
        { status: 500 }
      );
    }

    insertedAnomalies = (inserted as Anomaly[]) || [];
  }

  // --- Recalculate risk score from all active/acknowledged anomalies ---
  const { data: allActiveAnomalies, error: activeError } = await supabase!
    .from('anomalies')
    .select('*')
    .eq('vehicle_id', reading.vehicle_id)
    .in('status', ['active', 'acknowledged']);

  if (activeError) {
    return NextResponse.json(
      { error: 'Failed to fetch active anomalies for risk score', details: activeError.message },
      { status: 500 }
    );
  }

  const riskScore = calculateRiskScore((allActiveAnomalies as Anomaly[]) || []);

  // --- Update vehicle risk_score ---
  const { error: updateError } = await supabase!
    .from('vehicles')
    .update({ risk_score: riskScore, updated_at: new Date().toISOString() })
    .eq('id', reading.vehicle_id);

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update vehicle risk score', details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    anomalies: insertedAnomalies,
    risk_score: riskScore,
    anomalies_detected: detectedAnomalies.length,
  });
}

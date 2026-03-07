import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  runDispatchComparison,
  runResourceDepletion,
  runTrafficImpact,
  type DispatchComparisonParams,
  type ResourceDepletionParams,
  type TrafficImpactParams,
} from '@/lib/simulation-engine';
import type { ScenarioType } from '@/types';

interface ResolvedVehicle {
  id: string;
  name: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(['admin', 'dispatcher']);
  if ('error' in auth && auth.error) return auth.error;

  const { supabase, user } = auth as Exclude<typeof auth, { error: NextResponse }>;

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      scenario_type,
      name,
      description,
      parameters,
    }: {
      scenario_type: ScenarioType;
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    } = body;

    if (!scenario_type || !name || !parameters) {
      return NextResponse.json(
        { error: 'Missing required fields: scenario_type, name, parameters' },
        { status: 400 }
      );
    }

    // Run the simulation based on type
    let simulationOutput: Record<string, unknown>;
    let vehicleIds: string[] = [];

    switch (scenario_type) {
      case 'dispatch_comparison': {
        const result = runDispatchComparison(
          parameters as unknown as DispatchComparisonParams
        );
        simulationOutput = result as unknown as Record<string, unknown>;
        vehicleIds = result.vehicles.map((v) => v.vehicle_id);
        break;
      }
      case 'resource_depletion': {
        const result = runResourceDepletion(
          parameters as unknown as ResourceDepletionParams
        );
        simulationOutput = result as unknown as Record<string, unknown>;
        vehicleIds = [result.vehicle_id];
        break;
      }
      case 'traffic_impact': {
        const result = runTrafficImpact(
          parameters as unknown as TrafficImpactParams
        );
        simulationOutput = result as unknown as Record<string, unknown>;
        vehicleIds = [result.vehicle_id];
        break;
      }
      default:
        return NextResponse.json(
          { error: `Unsupported scenario type: ${scenario_type}` },
          { status: 400 }
        );
    }

    // Save scenario to DB
    const { data: scenario, error: scenarioError } = await supabase
      .from('scenarios')
      .insert({
        name,
        description: description || '',
        scenario_type,
        parameters,
        created_by: user.id,
        is_template: false,
      })
      .select()
      .single();

    if (scenarioError) {
      console.error('Failed to save scenario:', scenarioError);
      return NextResponse.json(
        { error: 'Failed to save scenario', details: scenarioError.message },
        { status: 500 }
      );
    }

    // ============================================================
    // Resolve vehicle_ids to real UUIDs + names from the DB.
    // ============================================================

    const resolvedMap = new Map<string, ResolvedVehicle>();

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const potentialUUIDs = vehicleIds.filter((id) => UUID_REGEX.test(id));
    const potentialNames = vehicleIds.filter((id) => !UUID_REGEX.test(id));

    if (potentialUUIDs.length > 0) {
      const { data: byId } = await supabase
        .from('vehicles')
        .select('id, name')
        .in('id', potentialUUIDs.map((id) => id.toLowerCase()));

      potentialUUIDs.forEach((inputId) => {
        const match = byId?.find(
          (v) => v.id.toLowerCase() === inputId.toLowerCase()
        );
        if (match) resolvedMap.set(inputId, { id: match.id, name: match.name });
      });
    }

    if (potentialNames.length > 0) {
      // Fetch all vehicles and match in JS to avoid PostgREST filter
      // injection from user-supplied name strings
      const { data: allByName } = await supabase
        .from('vehicles')
        .select('id, name');

      potentialNames.forEach((inputName) => {
        const match = allByName?.find(
          (v) => v.name.toLowerCase() === inputName.toLowerCase()
        );
        if (match) resolvedMap.set(inputName, { id: match.id, name: match.name });
      });
    }

    const unresolvedIds = vehicleIds.filter((vid) => !resolvedMap.has(vid));

    if (unresolvedIds.length > 0) {
      await supabase.from('scenarios').delete().eq('id', scenario.id);
      return NextResponse.json(
        {
          error: 'Could not resolve vehicle(s) id',
          unresolved_vehicle_ids: unresolvedIds,
        },
        { status: 422 }
      );
    }

    // Build result_data for each vehicle
    const resultRows = vehicleIds.flatMap((vid) => {
      const resolved = resolvedMap.get(vid);
      if (!resolved) return [];

      let estimated_response_time = 0;
      let fuel_consumption = 0;
      let risk_delta = 0;
      let coverage_impact = 0;
      let outcome_summary = '';
      // Extra fields per scenario type
      let delay_minutes = 0;
      let remaining_distance_km = 0;

      if (scenario_type === 'dispatch_comparison') {
        const dcResult = simulationOutput as unknown as ReturnType<typeof runDispatchComparison>;
        const vData = dcResult.vehicles.find((v) => v.vehicle_id === vid);
        if (vData) {
          estimated_response_time = vData.estimated_response_time_min;
          fuel_consumption = vData.fuel_consumption_litres;
          risk_delta = vData.risk_delta;
          coverage_impact = vData.recommended ? -5 : 5;
          outcome_summary = vData.recommended
            ? `RECOMMENDED — ${dcResult.recommendation}`
            : `${resolved.name} — Not recommended. ETA: ${vData.estimated_response_time_min.toFixed(1)} min.`;
        }
      } else if (scenario_type === 'resource_depletion') {
        const rdResult = simulationOutput as unknown as ReturnType<typeof runResourceDepletion>;
        fuel_consumption = rdResult.fuel_at_arrival_litres;
        // Pass through the original remaining_distance_km from parameters
        remaining_distance_km =
          typeof (parameters as Record<string, unknown>).remaining_distance_km === 'number'
            ? (parameters as Record<string, unknown>).remaining_distance_km as number
            : 0;
        risk_delta =
          rdResult.risk === 'critical' ? 40
          : rdResult.risk === 'high' ? 25
          : rdResult.risk === 'medium' ? 10
          : 0;
        coverage_impact = rdResult.will_complete ? 0 : 30;
        outcome_summary = rdResult.outcome_summary;
      } else if (scenario_type === 'traffic_impact') {
        const tiResult = simulationOutput as unknown as ReturnType<typeof runTrafficImpact>;
        estimated_response_time = tiResult.new_response_time_min;
        // delay_minutes = difference between new and original response time
        delay_minutes = tiResult.delay_minutes;
        risk_delta =
          tiResult.risk === 'critical' ? 40
          : tiResult.risk === 'high' ? 25
          : tiResult.risk === 'medium' ? 10
          : 0;
        coverage_impact = tiResult.delay_minutes > 5 ? 15 : 0;
        outcome_summary = tiResult.outcome_summary;
      }

      return {
        scenario_id: scenario.id,
        vehicle_id: resolved.id,
        vehicle_name: resolved.name, // stripped before DB insert
        result_data: {
          estimated_response_time,
          fuel_consumption,
          risk_delta,
          coverage_impact,
          outcome_summary,
          delay_minutes,
          remaining_distance_km,
          vehicle_name: resolved.name, // stored in JSONB for easy frontend access
        },
      };
    });

    // Strip vehicle_name top-level key before inserting (not a DB column)
    const dbRows = resultRows.map(({ vehicle_name: _vn, ...rest }) => rest);

    const { data: results, error: resultsError } = await supabase
      .from('simulation_results')
      .insert(dbRows)
      .select();

    if (resultsError) {
      console.error('Failed to save simulation results:', resultsError);
      return NextResponse.json(
        { error: 'Failed to save simulation results', details: resultsError.message },
        { status: 500 }
      );
    }

    // Enrich results with vehicle_name before returning to the frontend
    const enrichedResults = results?.map((r) => {
      const match = resultRows.find((row) => row.vehicle_id === r.vehicle_id);
      return {
        ...r,
        vehicle_name: match?.vehicle_name ?? null,
      };
    });

    return NextResponse.json({
      scenario,
      results: enrichedResults,
      simulation_output: simulationOutput,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error('Simulation run error:', errorMessage, errorStack);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
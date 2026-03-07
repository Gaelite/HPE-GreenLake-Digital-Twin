import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(['admin', 'dispatcher']);
  if ('error' in auth && auth.error) return auth.error;

  const { supabase } = auth as Exclude<typeof auth, { error: NextResponse }>;
  const { id } = await params;

  try {
    // Fetch the simulation result with its parent scenario
    const { data: result, error: resultError } = await supabase
      .from('simulation_results')
      .select('*, scenarios(*)')
      .eq('id', id)
      .single();

    if (resultError || !result) {
      // Maybe the id is a scenario_id — fetch all results for that scenario
      const { data: scenarioResults, error: scenarioError } = await supabase
        .from('simulation_results')
        .select('*, scenarios(*)')
        .eq('scenario_id', id)
        .order('created_at', { ascending: true });

      if (scenarioError || !scenarioResults || scenarioResults.length === 0) {
        return NextResponse.json(
          { error: 'Simulation result not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        scenario: scenarioResults[0].scenarios,
        results: scenarioResults.map((r) => ({
          id: r.id,
          scenario_id: r.scenario_id,
          vehicle_id: r.vehicle_id,
          result_data: r.result_data,
          created_at: r.created_at,
        })),
      });
    }

    // Also fetch sibling results for the same scenario (for comparison views)
    const { data: siblingResults } = await supabase
      .from('simulation_results')
      .select('*')
      .eq('scenario_id', result.scenario_id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      scenario: result.scenarios,
      results: (siblingResults || [result]).map((r) => ({
        id: r.id,
        scenario_id: r.scenario_id,
        vehicle_id: r.vehicle_id,
        result_data: r.result_data,
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error('Error fetching simulation result:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

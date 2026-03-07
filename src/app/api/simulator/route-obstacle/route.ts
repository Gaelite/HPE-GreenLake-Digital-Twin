import { NextResponse } from 'next/server';
import { WorldSimulation } from '@/lib/world-simulation';

/**
 * POST /api/simulator/route-obstacle
 *
 * Spawns a new "road obstacle" incident directly on the remaining route
 * of a vehicle that is currently en_route. Used by the Dynamic Route Demo
 * to showcase obstacle avoidance re-routing.
 *
 * Body: { vehicleId: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const vehicleId = body?.vehicleId;
    const routeCoords: { lat: number; lng: number }[] | undefined =
      Array.isArray(body?.routeCoords) ? body.routeCoords : undefined;

    if (!vehicleId || typeof vehicleId !== 'string') {
      return NextResponse.json({ error: 'Missing vehicleId' }, { status: 400 });
    }

    const sim = WorldSimulation.getInstance();

    if (!sim.isRunning()) {
      return NextResponse.json(
        { error: 'Simulation is not running' },
        { status: 400 },
      );
    }

    const result = await sim.spawnObstacleOnRoute(vehicleId, routeCoords);

    if (!result) {
      return NextResponse.json({
        success: false,
        reason:
          'Could not spawn obstacle — vehicle may not be en_route or route is too short',
      });
    }

    return NextResponse.json({ success: true, obstacle: result });
  } catch (err) {
    console.error('[route-obstacle] Error:', err);
    return NextResponse.json(
      { error: 'Internal error', detail: String(err) },
      { status: 500 },
    );
  }
}

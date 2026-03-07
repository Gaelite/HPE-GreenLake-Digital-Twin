import { NextResponse } from 'next/server';
import { WorldSimulation } from '@/lib/world-simulation';

export async function POST() {
  try {
    const sim = WorldSimulation.getInstance();

    if (sim.isRunning()) {
      return NextResponse.json({
        status: 'already_running',
        message: 'Simulator is already running',
        ...sim.getStatus(),
      });
    }

    const result = await sim.start();

    return NextResponse.json({
      status: 'started',
      message: `World simulation started for ${result.vehicleCount} vehicles`,
      ...sim.getStatus(),
    });
  } catch (err) {
    console.error('[Simulator Start]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const sim = WorldSimulation.getInstance();
  return NextResponse.json(sim.getStatus());
}

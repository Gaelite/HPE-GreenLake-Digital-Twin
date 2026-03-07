import { NextResponse } from 'next/server';
import { WorldSimulation } from '@/lib/world-simulation';

export async function POST() {
  try {
    const sim = WorldSimulation.getInstance();

    if (!sim.isRunning()) {
      return NextResponse.json({
        status: 'already_stopped',
        message: 'Simulator is not running',
      });
    }

    await sim.stop();

    return NextResponse.json({
      status: 'stopped',
      message: 'World simulation stopped and cleaned up',
    });
  } catch (err) {
    console.error('[Simulator Stop]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

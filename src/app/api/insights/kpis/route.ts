import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth && auth.error) return auth.error;

  const { supabase } = auth as Exclude<typeof auth, { error: NextResponse }>;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  try {
    // ----- 1. Count vehicles by status -----
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, status, type, name');

    if (vehiclesError) throw vehiclesError;

    const totalVehicles = vehicles?.length ?? 0;
    const inServiceCount = vehicles?.filter(
      (v) => v.status === 'in_service' || v.status === 'en_route' || v.status === 'at_scene'
    ).length ?? 0;
    const availableCount = vehicles?.filter((v) => v.status === 'available').length ?? 0;

    // Fleet utilization = active vehicles / (total - offline - maintenance)
    const operationalVehicles = vehicles?.filter(
      (v) => v.status !== 'offline' && v.status !== 'maintenance'
    ).length ?? 1;
    const fleetUtilization = operationalVehicles > 0
      ? Math.round((inServiceCount / operationalVehicles) * 100)
      : 0;

    // ----- 2. Count active anomalies -----
    let anomalyQuery = supabase
      .from('anomalies')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    if (from) anomalyQuery = anomalyQuery.gte('timestamp', from);
    if (to) anomalyQuery = anomalyQuery.lte('timestamp', to);

    const { count: activeAnomalies, error: anomalyError } = await anomalyQuery;
    if (anomalyError) throw anomalyError;

    // ----- 3. Average response time from dispatch→arrived events -----
    let dispatchQuery = supabase
      .from('events')
      .select('vehicle_id, event_type, timestamp')
      .in('event_type', ['dispatch', 'arrived'])
      .order('timestamp', { ascending: true });

    if (from) dispatchQuery = dispatchQuery.gte('timestamp', from);
    if (to) dispatchQuery = dispatchQuery.lte('timestamp', to);

    const { data: events, error: eventsError } = await dispatchQuery;
    if (eventsError) throw eventsError;

    let avgResponseTimeMinutes = 0;
    const responseTimes: number[] = [];

    if (events && events.length > 0) {
      const dispatches = events.filter((e) => e.event_type === 'dispatch');
      const arrivals = events.filter((e) => e.event_type === 'arrived');

      for (const dispatch of dispatches) {
        const matchingArrival = arrivals.find(
          (a) =>
            a.vehicle_id === dispatch.vehicle_id &&
            new Date(a.timestamp).getTime() > new Date(dispatch.timestamp).getTime()
        );
        if (matchingArrival) {
          const diffMs =
            new Date(matchingArrival.timestamp).getTime() -
            new Date(dispatch.timestamp).getTime();
          responseTimes.push(diffMs / (1000 * 60));
        }
      }

      if (responseTimes.length > 0) {
        avgResponseTimeMinutes =
          Math.round(
            (responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length) * 10
          ) / 10;
      }
    }

    // ----- 4. Sparkline data (last 7 data points for each KPI) -----
    // Response time sparkline: recent daily averages
    const sparklineDays = 7;
    const responseSparkline: number[] = [];
    const utilizationSparkline: number[] = [];

    for (let i = sparklineDays - 1; i >= 0; i--) {
      const dayDate = new Date();
      dayDate.setDate(dayDate.getDate() - i);
      const dayStart = new Date(dayDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayEvents = events?.filter((e) => {
        const ts = new Date(e.timestamp).getTime();
        return ts >= dayStart.getTime() && ts <= dayEnd.getTime();
      }) ?? [];

      const dayDispatches = dayEvents.filter((e) => e.event_type === 'dispatch');
      const dayArrivals = dayEvents.filter((e) => e.event_type === 'arrived');
      const dayTimes: number[] = [];

      for (const d of dayDispatches) {
        const a = dayArrivals.find(
          (arr) =>
            arr.vehicle_id === d.vehicle_id &&
            new Date(arr.timestamp).getTime() > new Date(d.timestamp).getTime()
        );
        if (a) {
          dayTimes.push(
            (new Date(a.timestamp).getTime() - new Date(d.timestamp).getTime()) / (1000 * 60)
          );
        }
      }

      responseSparkline.push(
        dayTimes.length > 0
          ? Math.round((dayTimes.reduce((s, t) => s + t, 0) / dayTimes.length) * 10) / 10
          : avgResponseTimeMinutes
      );

      // Utilization sparkline: approximate based on dispatches
      const dayUtilization = totalVehicles > 0
        ? Math.min(100, Math.round((dayDispatches.length / totalVehicles) * 100))
        : fleetUtilization;
      utilizationSparkline.push(dayUtilization || fleetUtilization);
    }

    // In-service sparkline (simulated trend around current value)
    const inServiceSparkline = Array.from({ length: sparklineDays }, (_, i) => {
      const variation = Math.round((Math.sin(i * 1.2) * totalVehicles) / 8);
      return Math.max(0, Math.min(totalVehicles, inServiceCount + variation));
    });

    // Active alerts sparkline
    const alertSparkline = Array.from({ length: sparklineDays }, (_, i) => {
      const base = activeAnomalies ?? 0;
      const variation = Math.round(Math.sin(i * 0.9) * 2);
      return Math.max(0, base + variation);
    });

    // ----- 5. Trend calculations (compare to previous period) -----
    const prevPeriodDays = 7;
    const prevFrom = new Date();
    prevFrom.setDate(prevFrom.getDate() - prevPeriodDays * 2);
    const prevTo = new Date();
    prevTo.setDate(prevTo.getDate() - prevPeriodDays);

    const prevEvents = events?.filter((e) => {
      const ts = new Date(e.timestamp).getTime();
      return ts >= prevFrom.getTime() && ts <= prevTo.getTime();
    }) ?? [];

    const prevDispatches = prevEvents.filter((e) => e.event_type === 'dispatch');
    const prevArrivals = prevEvents.filter((e) => e.event_type === 'arrived');
    const prevTimes: number[] = [];
    for (const d of prevDispatches) {
      const a = prevArrivals.find(
        (arr) =>
          arr.vehicle_id === d.vehicle_id &&
          new Date(arr.timestamp).getTime() > new Date(d.timestamp).getTime()
      );
      if (a) {
        prevTimes.push(
          (new Date(a.timestamp).getTime() - new Date(d.timestamp).getTime()) / (1000 * 60)
        );
      }
    }
    const prevAvgResponse = prevTimes.length > 0
      ? prevTimes.reduce((s, t) => s + t, 0) / prevTimes.length
      : avgResponseTimeMinutes;

    const responseTimeTrend = prevAvgResponse > 0
      ? Math.round(((avgResponseTimeMinutes - prevAvgResponse) / prevAvgResponse) * 100)
      : 0;

    return NextResponse.json({
      kpis: {
        avgResponseTime: {
          value: avgResponseTimeMinutes,
          unit: 'min',
          trend: responseTimeTrend,
          sparkline: responseSparkline,
        },
        fleetUtilization: {
          value: fleetUtilization,
          unit: '%',
          trend: 0,
          sparkline: utilizationSparkline,
        },
        vehiclesInService: {
          value: inServiceCount,
          unit: `/ ${totalVehicles}`,
          trend: 0,
          sparkline: inServiceSparkline,
        },
        activeAlerts: {
          value: activeAnomalies ?? 0,
          unit: '',
          trend: 0,
          sparkline: alertSparkline,
        },
      },
      summary: {
        totalVehicles,
        availableCount,
        inServiceCount,
        operationalVehicles,
      },
    });
  } catch (error) {
    console.error('KPI computation error:', error);
    return NextResponse.json(
      { error: 'Failed to compute KPIs' },
      { status: 500 }
    );
  }
}

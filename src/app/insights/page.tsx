import AppShell from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import KPIDashboard from '@/components/insights/KPIDashboard';
import ResponseTimeChart from '@/components/insights/ResponseTimeChart';
import FleetUtilizationGrid from '@/components/insights/FleetUtilizationGrid';
import ReportExporter from '@/components/insights/ReportExporter';
import InsightsRecommendationsList from './InsightsRecommendationsList';

export const metadata = {
  title: 'Insights & Analytics',
  description: 'Fleet analytics dashboard with KPIs, response time analysis, and automated insights.',
};

export default async function InsightsPage() {
  // Pre-fetch some server-side data for initial render
  const supabase = await createClient();

  // Get summary stats for the header
  const { count: totalVehicles } = await supabase
    .from('vehicles')
    .select('id', { count: 'exact', head: true });

  const { count: activeAnomalies } = await supabase
    .from('anomalies')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: recentEvents } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Insights & Analytics
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Real-time fleet performance metrics, automated recommendations, and data exports.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-gray-200">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-gray-600">
                <span className="font-semibold text-gray-900">{totalVehicles ?? 0}</span> vehicles
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-gray-200">
              <span className="text-gray-600">
                <span className="font-semibold text-gray-900">{recentEvents ?? 0}</span> events (24h)
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-gray-200">
              <span className={`h-2 w-2 rounded-full ${(activeAnomalies ?? 0) > 0 ? 'bg-red-400 animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-gray-600">
                <span className="font-semibold text-gray-900">{activeAnomalies ?? 0}</span> alerts
              </span>
            </div>
          </div>
        </div>

        {/* KPI Dashboard (client) */}
        <section>
          <KPIDashboard />
        </section>

        {/* Recommendations / Insights — promoted to second section */}
        <section>
          <InsightsRecommendationsList />
        </section>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResponseTimeChart />
          <ReportExporter />
        </div>

        {/* Fleet Utilization Grid */}
        <section>
          <FleetUtilizationGrid />
        </section>
      </div>
    </AppShell>
  );
}

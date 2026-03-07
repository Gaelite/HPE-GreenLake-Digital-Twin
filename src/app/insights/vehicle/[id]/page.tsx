import AppShell from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { VehicleType, VehicleStatus, MetricType } from '@/types';
import VehicleAnalyticsClient from './VehicleAnalyticsClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL_COLORS: Record<VehicleStatus, { bg: string; text: string }> = {
  available: { bg: 'bg-green-100', text: 'text-green-800' },
  in_service: { bg: 'bg-blue-100', text: 'text-blue-800' },
  en_route: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  at_scene: { bg: 'bg-orange-100', text: 'text-orange-800' },
  maintenance: { bg: 'bg-gray-100', text: 'text-gray-800' },
  offline: { bg: 'bg-red-100', text: 'text-red-800' },
};

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  police: 'Police',
  ambulance: 'Ambulance',
  fire_truck: 'Fire Truck',
  civil_protection: 'Civil Protection',
  hybrid: 'Hybrid',
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('name')
    .eq('id', id)
    .single();

  return {
    title: vehicle ? `${vehicle.name} Analytics` : 'Vehicle Analytics',
  };
}

export default async function VehicleAnalyticsPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch vehicle details
  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !vehicle) {
    notFound();
  }

  // Fetch vehicle-specific summary data in parallel
  const [anomalyCountRes, eventCountRes, recentAnomaliesRes] = await Promise.all([
    supabase
      .from('anomalies')
      .select('id', { count: 'exact', head: true })
      .eq('vehicle_id', id)
      .eq('status', 'active'),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('vehicle_id', id)
      .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('anomalies')
      .select('severity, anomaly_type, metric_type, timestamp, description')
      .eq('vehicle_id', id)
      .order('timestamp', { ascending: false })
      .limit(10),
  ]);

  const activeAnomalies = anomalyCountRes.count ?? 0;
  const recentEventCount = eventCountRes.count ?? 0;
  const recentAnomalies = recentAnomaliesRes.data ?? [];

  const statusColors = STATUS_LABEL_COLORS[vehicle.status as VehicleStatus] ?? { bg: 'bg-gray-100', text: 'text-gray-800' };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb + Header */}
        <div>
          <nav className="mb-3">
            <ol className="flex items-center gap-2 text-sm text-gray-500">
              <li>
                <a href="/insights" className="hover:text-indigo-600 transition-colors">
                  Insights
                </a>
              </li>
              <li>
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </li>
              <li className="font-medium text-gray-900">{vehicle.name}</li>
            </ol>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  {vehicle.name}
                </h1>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                  {(vehicle.status as string).replace('_', ' ')}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {VEHICLE_TYPE_LABELS[vehicle.type as VehicleType] ?? vehicle.type} &middot; {vehicle.plate_number} &middot; {vehicle.year} {vehicle.make} {vehicle.model}
              </p>
            </div>

            <a
              href="/insights"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </a>
          </div>
        </div>

        {/* Summary KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Risk Score"
            value={vehicle.risk_score}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
            color={vehicle.risk_score > 70 ? 'red' : vehicle.risk_score > 40 ? 'amber' : 'green'}
          />
          <SummaryCard
            label="Active Alerts"
            value={activeAnomalies}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            }
            color={activeAnomalies > 0 ? 'red' : 'green'}
          />
          <SummaryCard
            label="Events (30d)"
            value={recentEventCount}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            color="blue"
          />
          <SummaryCard
            label="Status"
            value={(vehicle.status as string).replace('_', ' ')}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            color="indigo"
          />
        </div>

        {/* Client-side interactive analytics */}
        <VehicleAnalyticsClient
          vehicleId={id}
          recentAnomalies={recentAnomalies}
        />
      </div>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'red' | 'amber' | 'green' | 'blue' | 'indigo';
}) {
  const colorMap = {
    red: { bg: 'bg-red-50', text: 'text-red-600', icon: 'bg-red-100 text-red-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'bg-amber-100 text-amber-600' },
    green: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'bg-emerald-100 text-emerald-600' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-100 text-blue-600' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'bg-indigo-100 text-indigo-600' },
  };
  const c = colorMap[color];

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.icon}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-bold capitalize ${c.text}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

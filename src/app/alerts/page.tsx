import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';
import AnomalyList from '@/components/anomaly/AnomalyList';
import AlertBanner from '@/components/anomaly/AlertBanner';
import type { Anomaly } from '@/types';

export const metadata = {
  title: 'Alerts',
  description: 'View and manage vehicle anomaly alerts',
};

interface AlertsPageProps {
  searchParams: Promise<{
    severity?: string;
    status?: string;
    vehicle_id?: string;
  }>;
}

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  // --- Fetch anomalies with filters ---
  let query = supabase
    .from('anomalies')
    .select('*, vehicles(name, plate_number, type)', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .limit(200);

  if (params.severity && ['info', 'warning', 'critical'].includes(params.severity)) {
    query = query.eq('severity', params.severity);
  }

  if (params.status && ['active', 'acknowledged', 'resolved'].includes(params.status)) {
    query = query.eq('status', params.status);
  }

  if (params.vehicle_id) {
    query = query.eq('vehicle_id', params.vehicle_id);
  }

  const { data: anomalies, count } = await query;

  // --- Count critical active alerts for the banner ---
  const { count: criticalCount } = await supabase
    .from('anomalies')
    .select('*', { count: 'exact', head: true })
    .eq('severity', 'critical')
    .eq('status', 'active');

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Critical Alert Banner */}
        {(criticalCount ?? 0) > 0 && (
          <AlertBanner criticalCount={criticalCount ?? 0} />
        )}

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
            <p className="mt-1 text-sm text-gray-500">
              {count ?? 0} anomal{(count ?? 0) === 1 ? 'y' : 'ies'} found
            </p>
          </div>
        </div>

        {/* Anomaly List with Filters */}
        <AnomalyList
          initialAnomalies={(anomalies as (Anomaly & { vehicles: { name: string; plate_number: string; type: string } })[]) || []}
          initialSeverity={params.severity || ''}
          initialStatus={params.status || ''}
        />
      </div>
    </AppShell>
  );
}

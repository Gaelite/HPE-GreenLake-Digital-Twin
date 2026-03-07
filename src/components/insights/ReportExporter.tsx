'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface VehicleOption {
  id: string;
  name: string;
  plate_number: string;
}

type DataType = 'telemetry' | 'events' | 'anomalies';

export default function ReportExporter() {
  const [dataType, setDataType] = useState<DataType>('telemetry');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default date range to last 7 days
  useEffect(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    setToDate(now.toISOString().slice(0, 10));
    setFromDate(weekAgo.toISOString().slice(0, 10));
  }, []);

  // Fetch vehicle options
  useEffect(() => {
    async function fetchVehicles() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('vehicles')
          .select('id, name, plate_number')
          .order('name');
        setVehicles(data ?? []);
      } catch {
        // silently fail — vehicles just won't appear as filter options
      }
    }
    fetchVehicles();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setError(null);

    try {
      const params = new URLSearchParams({ type: dataType });
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        params.set('to', end.toISOString());
      }
      if (vehicleId) params.set('vehicle_id', vehicleId);

      const res = await fetch(`/api/insights/export?${params.toString()}`);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(errData.error ?? 'Export failed');
      }

      // Download the CSV
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataType}_export_${fromDate}_${toDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 p-5">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export Report
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Download fleet data as CSV for external analysis
        </p>
      </div>

      <div className="space-y-4">
        {/* Data Type Selector */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Data Type
          </label>
          <div className="flex gap-2">
            {(['telemetry', 'events', 'anomalies'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setDataType(type)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  dataType === type
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="from-date" className="block text-xs font-medium text-gray-700 mb-1.5">
              From Date
            </label>
            <input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="to-date" className="block text-xs font-medium text-gray-700 mb-1.5">
              To Date
            </label>
            <input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Vehicle Filter */}
        <div>
          <label htmlFor="vehicle-select" className="block text-xs font-medium text-gray-700 mb-1.5">
            Vehicle (optional)
          </label>
          <select
            id="vehicle-select"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.plate_number})
              </option>
            ))}
          </select>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={exporting || !fromDate || !toDate}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {exporting ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </>
          )}
        </button>
      </div>
    </div>
  );
}

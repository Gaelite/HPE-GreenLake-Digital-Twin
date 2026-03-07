'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { SimulationResult } from '@/types';

interface Props {
  results: SimulationResult[];
  title?: string;
}

const COLORS = ['#3b82f6', '#f59e0b'];

// Read vehicle_name directly from result_data JSONB (stored by the backend)
function getVehicleLabel(result: SimulationResult): string {
  return result.result_data.vehicle_name ?? result.vehicle_id.slice(-8);
}

export default function ComparisonView({ results, title }: Props) {
  if (results.length < 2) return null;

  const r1 = results[0];
  const r2 = results[1];

  const label1 = getVehicleLabel(r1);
  const label2 = getVehicleLabel(r2);

  const responseTimeData = [
    { name: label1, value: r1.result_data.estimated_response_time },
    { name: label2, value: r2.result_data.estimated_response_time },
  ];
  const fuelData = [
    { name: label1, value: r1.result_data.fuel_consumption },
    { name: label2, value: r2.result_data.fuel_consumption },
  ];
  const riskData = [
    { name: label1, value: r1.result_data.risk_delta },
    { name: label2, value: r2.result_data.risk_delta },
  ];
  const coverageData = [
    { name: label1, value: r1.result_data.coverage_impact },
    { name: label2, value: r2.result_data.coverage_impact },
  ];
  const overviewData = [
    {
      metric: 'Response Time (min)',
      [label1]: r1.result_data.estimated_response_time,
      [label2]: r2.result_data.estimated_response_time,
    },
    {
      metric: 'Fuel (L)',
      [label1]: r1.result_data.fuel_consumption,
      [label2]: r2.result_data.fuel_consumption,
    },
    {
      metric: 'Risk Delta',
      [label1]: r1.result_data.risk_delta,
      [label2]: r2.result_data.risk_delta,
    },
    {
      metric: 'Coverage Impact',
      [label1]: r1.result_data.coverage_impact,
      [label2]: r2.result_data.coverage_impact,
    },
  ];

  const renderChart = (
    data: { name: string; value: number }[],
    label: string,
    unit: string
  ) => (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{label}</h4>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)} ${unit}`, label]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        {title || 'Side-by-Side Comparison'}
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        Comparing{' '}
        <span className="font-medium text-blue-600">{label1}</span> vs{' '}
        <span className="font-medium text-amber-600">{label2}</span>
      </p>

      {/* Combined overview bar chart */}
      <div className="mb-6 bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">All Metrics Overview</h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={overviewData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey={label1} fill={COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey={label2} fill={COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Individual metric charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderChart(responseTimeData, 'Response Time', 'min')}
        {renderChart(fuelData, 'Fuel Consumption', 'L')}
        {renderChart(riskData, 'Risk Delta', 'pts')}
        {renderChart(coverageData, 'Coverage Impact', 'pts')}
      </div>

      {/* Side-by-side summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {results.slice(0, 2).map((result, idx) => {
          const label = idx === 0 ? label1 : label2;
          const isRecommended = result.result_data.outcome_summary.startsWith('RECOMMENDED');
          return (
            <div
              key={result.id || idx}
              className={`rounded-lg p-4 border-2 ${
                idx === 0 ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-sm font-semibold ${idx === 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                  {label}
                </h4>
                {isRecommended && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    ✓ Recommended
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">{result.result_data.outcome_summary}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
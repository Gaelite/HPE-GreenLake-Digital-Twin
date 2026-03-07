'use client';

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  in_service: 'bg-blue-100 text-blue-700',
  en_route: 'bg-yellow-100 text-yellow-700',
  at_scene: 'bg-orange-100 text-orange-700',
  maintenance: 'bg-red-100 text-red-700',
  offline: 'bg-gray-100 text-gray-500',
};

export interface RealVehicle {
  id: string;
  name: string;
  type: string;
  status: string;
  plate_number: string;
  current_latitude: number | null;
  current_longitude: number | null;
  risk_score: number;
  specifications: {
    tank_capacity_liters?: number;
    fuel_consumption_rate?: number;
    avg_speed_kmh?: number;
    [key: string]: unknown;
  };
}

interface VehicleSelectProps {
  value: string;
  onChange: (v: RealVehicle) => void;
  excludeId?: string;
  label: string;
  vehicles: RealVehicle[];
  vehiclesLoading: boolean;
  vehiclesError: string | null;
}

export default function VehicleSelect({
  value,
  onChange,
  excludeId,
  label,
  vehicles,
  vehiclesLoading,
  vehiclesError,
}: VehicleSelectProps) {
  const selectedVehicle = vehicles.find((v) => v.id === value);
  const options = vehicles.filter((v) => v.id !== excludeId);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {vehiclesLoading ? (
        <div className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-400 flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading vehicles...
        </div>
      ) : vehiclesError ? (
        <div className="w-full px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-sm text-red-600">
          {vehiclesError}
        </div>
      ) : (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => {
              const v = vehicles.find((v) => v.id === e.target.value);
              if (v) onChange(v);
            }}
            className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white"
          >
            <option value="">— Select a vehicle —</option>
            {options.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.plate_number}) · {v.type.replace('_', ' ')}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}

      {/* Selected vehicle info pill */}
      {selectedVehicle && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
          <span className="font-semibold">{selectedVehicle.name}</span>
          <span className="text-blue-400">·</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
              STATUS_COLORS[selectedVehicle.status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {selectedVehicle.status.replace('_', ' ')}
          </span>
          {selectedVehicle.current_latitude && (
            <>
              <span className="text-blue-400">·</span>
              <span className="text-blue-600">
                {selectedVehicle.current_latitude.toFixed(4)},{' '}
                {selectedVehicle.current_longitude?.toFixed(4)}
              </span>
            </>
          )}
          <span className="text-blue-400">·</span>
          <span>
            Risk: <span className="font-semibold">{selectedVehicle.risk_score}</span>
          </span>
        </div>
      )}
    </div>
  );
}
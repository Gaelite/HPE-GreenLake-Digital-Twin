'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ScenarioType } from '@/types';
import VehicleSelect, { type RealVehicle } from './VehicleSelect';

// ----- Param shapes per scenario type -----

interface VehicleInput {
  vehicle_id: string;
  name: string;
  latitude: number;
  longitude: number;
  current_fuel: number;
  avg_speed_kmh: number;
  fuel_consumption_rate: number;
  risk_score: number;
}

interface DispatchParams {
  vehicles: [VehicleInput, VehicleInput];
  incident_latitude: number;
  incident_longitude: number;
  traffic_factor: number;
}

interface ResourceParams {
  vehicle_id: string;
  vehicle_name: string;
  current_fuel_litres: number;
  fuel_tank_capacity_litres: number;
  consumption_rate_per_km: number;
  remaining_distance_km: number;
}

interface TrafficParams {
  vehicle_id: string;
  vehicle_name: string;
  current_response_time_min: number;
  traffic_increase_pct: number;
}

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  dispatch_comparison: 'Dispatch Comparison',
  resource_depletion: 'Resource Depletion',
  traffic_impact: 'Traffic Impact',
  equipment_failure: 'Equipment Failure',
  multi_vehicle: 'Multi-Vehicle',
};

const defaultVehicleInput = (): VehicleInput => ({
  vehicle_id: '',
  name: '',
  latitude: 40.4168,
  longitude: -3.7038,
  current_fuel: 80,
  avg_speed_kmh: 60,
  fuel_consumption_rate: 0.15,
  risk_score: 10,
});

interface Props {
  onResult?: (data: Record<string, unknown>) => void;
  preloadedParams?: {
    scenario_type: ScenarioType;
    name?: string;
    description?: string;
    parameters: Record<string, unknown>;
  } | null;
}

export default function ScenarioBuilder({ onResult, preloadedParams }: Props) {
  const [scenarioType, setScenarioType] = useState<ScenarioType>(
    preloadedParams?.scenario_type || 'dispatch_comparison'
  );
  const [name, setName] = useState(preloadedParams?.name || '');
  const [description, setDescription] = useState(
    preloadedParams?.description || ''
  );

  // Real vehicles fetched from API
  const [vehicles, setVehicles] = useState<RealVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/vehicles');
        if (!res.ok) throw new Error('Failed to load vehicles');
        const data: RealVehicle[] = await res.json();
        setVehicles(data);
      } catch {
        setVehiclesError('Could not load vehicles. Check connection.');
      } finally {
        setVehiclesLoading(false);
      }
    };
    load();
  }, []);

  // Dispatch params
  const [dispatchParams, setDispatchParams] = useState<DispatchParams>(() => {
    if (
      preloadedParams?.scenario_type === 'dispatch_comparison' &&
      preloadedParams.parameters
    ) {
      return preloadedParams.parameters as unknown as DispatchParams;
    }
    return {
      vehicles: [defaultVehicleInput(), defaultVehicleInput()],
      incident_latitude: 40.42,
      incident_longitude: -3.7,
      traffic_factor: 1.0,
    };
  });

  // Resource params
  const [resourceParams, setResourceParams] = useState<ResourceParams>(() => {
    if (
      preloadedParams?.scenario_type === 'resource_depletion' &&
      preloadedParams.parameters
    ) {
      return preloadedParams.parameters as unknown as ResourceParams;
    }
    return {
      vehicle_id: '',
      vehicle_name: '',
      current_fuel_litres: 30,
      fuel_tank_capacity_litres: 60,
      consumption_rate_per_km: 0.15,
      remaining_distance_km: 50,
    };
  });

  // Traffic params
  const [trafficParams, setTrafficParams] = useState<TrafficParams>(() => {
    if (
      preloadedParams?.scenario_type === 'traffic_impact' &&
      preloadedParams.parameters
    ) {
      return preloadedParams.parameters as unknown as TrafficParams;
    }
    return {
      vehicle_id: '',
      vehicle_name: '',
      current_response_time_min: 10,
      traffic_increase_pct: 30,
    };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Vehicle selection helpers ----

  const applyVehicleToDispatch = (idx: 0 | 1, v: RealVehicle) => {
    setDispatchParams((prev) => {
      const updated = [...prev.vehicles] as [VehicleInput, VehicleInput];
      updated[idx] = {
        vehicle_id: v.id,
        name: v.name,
        latitude: v.current_latitude ?? 40.4168,
        longitude: v.current_longitude ?? -3.7038,
        current_fuel: 80,
        avg_speed_kmh: (v.specifications?.avg_speed_kmh as number) ?? 60,
        fuel_consumption_rate:
          (v.specifications?.fuel_consumption_rate as number) ?? 0.15,
        risk_score: v.risk_score,
      };
      return { ...prev, vehicles: updated };
    });
  };

  const applyVehicleToResource = (v: RealVehicle) => {
    setResourceParams((prev) => ({
      ...prev,
      vehicle_id: v.id,
      vehicle_name: v.name,
      fuel_tank_capacity_litres:
        (v.specifications?.tank_capacity_liters as number) ?? 60,
    }));
  };

  const applyVehicleToTraffic = (v: RealVehicle) => {
    setTrafficParams((prev) => ({
      ...prev,
      vehicle_id: v.id,
      vehicle_name: v.name,
    }));
  };

  // Template loader
  const loadTemplate = useCallback(
    (tpl: {
      scenario_type: ScenarioType;
      name?: string;
      description?: string;
      parameters: Record<string, unknown>;
    }) => {
      setScenarioType(tpl.scenario_type);
      setName(tpl.name || '');
      setDescription(tpl.description || '');
      setError(null);
      if (tpl.scenario_type === 'dispatch_comparison') {
        setDispatchParams(tpl.parameters as unknown as DispatchParams);
      } else if (tpl.scenario_type === 'resource_depletion') {
        setResourceParams(tpl.parameters as unknown as ResourceParams);
      } else if (tpl.scenario_type === 'traffic_impact') {
        setTrafficParams(tpl.parameters as unknown as TrafficParams);
      }
    },
    []
  );

  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__loadScenarioTemplate =
      loadTemplate;
  }

  const getCurrentParams = (): Record<string, unknown> => {
    switch (scenarioType) {
      case 'dispatch_comparison':
        return dispatchParams as unknown as Record<string, unknown>;
      case 'resource_depletion':
        return resourceParams as unknown as Record<string, unknown>;
      case 'traffic_impact':
        return trafficParams as unknown as Record<string, unknown>;
      default:
        return {};
    }
  };

  const handleRun = async () => {
    if (!name.trim()) {
      setError('Please enter a scenario name.');
      return;
    }
    if (scenarioType === 'dispatch_comparison') {
      if (!dispatchParams.vehicles[0].vehicle_id || !dispatchParams.vehicles[1].vehicle_id) {
        setError('Please select both vehicles for the comparison.');
        return;
      }
      if (dispatchParams.vehicles[0].vehicle_id === dispatchParams.vehicles[1].vehicle_id) {
        setError('Please select two different vehicles.');
        return;
      }
    }
    if (scenarioType === 'resource_depletion' && !resourceParams.vehicle_id) {
      setError('Please select a vehicle.');
      return;
    }
    if (scenarioType === 'traffic_impact' && !trafficParams.vehicle_id) {
      setError('Please select a vehicle.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/simulation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_type: scenarioType,
          name: name.trim(),
          description: description.trim(),
          parameters: getCurrentParams(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to run simulation');
      }

      const data = await res.json();
      onResult?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updateDispatchVehicle = (
    idx: 0 | 1,
    field: keyof VehicleInput,
    value: string | number
  ) => {
    setDispatchParams((prev) => {
      const updated = [...prev.vehicles] as [VehicleInput, VehicleInput];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, vehicles: updated };
    });
  };

  // Shared props passed down to every VehicleSelect instance
  const vehicleSelectSharedProps = { vehicles, vehiclesLoading, vehiclesError };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Scenario Builder
      </h2>

      {/* Scenario name & description */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scenario Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Downtown Rush Hour Dispatch"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this scenario"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Scenario type selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Scenario Type
        </label>
        <div className="flex flex-wrap gap-2">
          {(
            ['dispatch_comparison', 'resource_depletion', 'traffic_impact'] as ScenarioType[]
          ).map((type) => (
            <button
              key={type}
              onClick={() => setScenarioType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scenarioType === type
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {SCENARIO_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* ----- Dispatch Comparison Fields ----- */}
      {scenarioType === 'dispatch_comparison' && (
        <div className="space-y-6">
          {/* Incident location */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Incident Location
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={dispatchParams.incident_latitude}
                  onChange={(e) =>
                    setDispatchParams((p) => ({
                      ...p,
                      incident_latitude: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={dispatchParams.incident_longitude}
                  onChange={(e) =>
                    setDispatchParams((p) => ({
                      ...p,
                      incident_longitude: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Traffic Factor */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Traffic Factor:{' '}
              <span className="text-blue-600">{dispatchParams.traffic_factor.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={dispatchParams.traffic_factor}
              onChange={(e) =>
                setDispatchParams((p) => ({
                  ...p,
                  traffic_factor: parseFloat(e.target.value),
                }))
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0.5x (Clear)</span>
              <span>1.0x (Normal)</span>
              <span>3.0x (Gridlock)</span>
            </div>
          </div>

          {/* Two vehicle cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([0, 1] as const).map((idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4"
              >
                <h4 className="text-sm font-semibold text-gray-700">
                  Vehicle {idx + 1}
                </h4>

                <VehicleSelect
                  {...vehicleSelectSharedProps}
                  label="Select vehicle"
                  value={dispatchParams.vehicles[idx].vehicle_id}
                  excludeId={dispatchParams.vehicles[idx === 0 ? 1 : 0].vehicle_id}
                  onChange={(v) => applyVehicleToDispatch(idx, v)}
                />

                {/* Manual overrides */}
                {dispatchParams.vehicles[idx].vehicle_id && (
                  <div className="space-y-3 pt-2 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Override values
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                        <input
                          type="number"
                          step="0.001"
                          value={dispatchParams.vehicles[idx].latitude}
                          onChange={(e) =>
                            updateDispatchVehicle(idx, 'latitude', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1.5 rounded border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                        <input
                          type="number"
                          step="0.001"
                          value={dispatchParams.vehicles[idx].longitude}
                          onChange={(e) =>
                            updateDispatchVehicle(idx, 'longitude', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1.5 rounded border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fuel (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={dispatchParams.vehicles[idx].current_fuel}
                          onChange={(e) =>
                            updateDispatchVehicle(idx, 'current_fuel', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1.5 rounded border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-amber-600 mt-1">
                          ⚠ Simulation value — not real-time fuel data.
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Speed (km/h)</label>
                        <input
                          type="number"
                          min="1"
                          value={dispatchParams.vehicles[idx].avg_speed_kmh}
                          onChange={(e) =>
                            updateDispatchVehicle(idx, 'avg_speed_kmh', parseFloat(e.target.value) || 1)
                          }
                          className="w-full px-2 py-1.5 rounded border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fuel Rate (L/km)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={dispatchParams.vehicles[idx].fuel_consumption_rate}
                          onChange={(e) =>
                            updateDispatchVehicle(idx, 'fuel_consumption_rate', parseFloat(e.target.value) || 0.01)
                          }
                          className="w-full px-2 py-1.5 rounded border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Risk Score</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={dispatchParams.vehicles[idx].risk_score}
                          onChange={(e) =>
                            updateDispatchVehicle(idx, 'risk_score', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1.5 rounded border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----- Resource Depletion Fields ----- */}
      {scenarioType === 'resource_depletion' && (
        <div className="space-y-4">
          <VehicleSelect
            {...vehicleSelectSharedProps}
            label="Select vehicle"
            value={resourceParams.vehicle_id}
            onChange={applyVehicleToResource}
          />

          {resourceParams.vehicle_id && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Fuel (L)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={resourceParams.current_fuel_litres}
                  onChange={(e) =>
                    setResourceParams((p) => ({
                      ...p,
                      current_fuel_litres: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tank Capacity (L)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={resourceParams.fuel_tank_capacity_litres}
                  onChange={(e) =>
                    setResourceParams((p) => ({
                      ...p,
                      fuel_tank_capacity_litres: parseFloat(e.target.value) || 1,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consumption (L/km)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={resourceParams.consumption_rate_per_km}
                  onChange={(e) =>
                    setResourceParams((p) => ({
                      ...p,
                      consumption_rate_per_km: parseFloat(e.target.value) || 0.01,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remaining Distance (km)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={resourceParams.remaining_distance_km}
                  onChange={(e) =>
                    setResourceParams((p) => ({
                      ...p,
                      remaining_distance_km: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----- Traffic Impact Fields ----- */}
      {scenarioType === 'traffic_impact' && (
        <div className="space-y-4">
          <VehicleSelect
            {...vehicleSelectSharedProps}
            label="Select vehicle"
            value={trafficParams.vehicle_id}
            onChange={applyVehicleToTraffic}
          />

          {trafficParams.vehicle_id && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Response Time (min)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={trafficParams.current_response_time_min}
                  onChange={(e) =>
                    setTrafficParams((p) => ({
                      ...p,
                      current_response_time_min: parseFloat(e.target.value) || 0.5,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Traffic Increase:{' '}
                  <span className="text-blue-600">{trafficParams.traffic_increase_pct}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="5"
                  value={trafficParams.traffic_increase_pct}
                  onChange={(e) =>
                    setTrafficParams((p) => ({
                      ...p,
                      traffic_increase_pct: parseInt(e.target.value),
                    }))
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span>100%</span>
                  <span>200%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Run Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleRun}
          disabled={loading}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running Simulation...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Simulation
            </>
          )}
        </button>
      </div>
    </div>
  );
}
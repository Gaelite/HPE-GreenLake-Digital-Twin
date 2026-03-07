'use client';

import { useVehicleTwin } from '@/hooks/useVehicleTwin';
import type { Vehicle, VehicleEquipment, TelemetryReading } from '@/types';
import VehicleTypeIcon from '@/components/fleet/VehicleTypeIcon';
import StatusBadge from '@/components/fleet/StatusBadge';
import MetricGauge from './MetricGauge';
import ReadinessScore from './ReadinessScore';
import EquipmentChecklist from './EquipmentChecklist';
import StatusIndicator from './StatusIndicator';

interface VehicleDetailPanelProps {
  /** Initial vehicle data from server-side fetch */
  initialVehicle: Vehicle;
  /** Initial telemetry from server-side fetch */
  initialTelemetry?: Record<string, TelemetryReading>;
  /** Equipment list (not realtime) */
  equipment: VehicleEquipment[];
}

export default function VehicleDetailPanel({
  initialVehicle,
  initialTelemetry = {},
  equipment,
}: VehicleDetailPanelProps) {
  // Subscribe to realtime updates
  const { vehicle: realtimeVehicle, latestTelemetry, isConnected } = useVehicleTwin(
    initialVehicle.id
  );

  // Use realtime data when available, fall back to initial
  const vehicle = realtimeVehicle ?? initialVehicle;
  const telemetry = Object.keys(latestTelemetry).length > 0 ? latestTelemetry : initialTelemetry;

  // Extract metric values for convenience
  const speed = telemetry.speed?.value ?? 0;
  const fuelLevel = telemetry.fuel_level?.value ?? 0;
  const engineTemp = telemetry.engine_temp?.value ?? 0;
  const batteryVoltage = telemetry.battery_voltage?.value ?? 0;
  const rpm = telemetry.rpm?.value ?? 0;
  const oilPressure = telemetry.oil_pressure?.value ?? 0;
  const tirePressure = telemetry.tire_pressure?.value ?? 0;

  return (
    <div className="space-y-6">
      {/* ===== HEADER SECTION ===== */}
      <div className="bg-gray-900 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10">
              <VehicleTypeIcon type={vehicle.type} size="lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{vehicle.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-gray-400">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-sm text-gray-400">{vehicle.plate_number}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection status */}
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                }`}
              />
              <span className="text-xs text-gray-400">
                {isConnected ? 'Live' : 'Connecting...'}
              </span>
            </div>
            <StatusBadge status={vehicle.status} size="lg" />
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-white/10">
          <QuickStat label="Speed" value={`${speed.toFixed(0)} km/h`} />
          <QuickStat label="Fuel Level" value={`${fuelLevel.toFixed(0)}%`} />
          <QuickStat label="Risk Score" value={`${vehicle.risk_score}`} />
          <QuickStat
            label="Location"
            value={
              vehicle.current_latitude && vehicle.current_longitude
                ? `${vehicle.current_latitude.toFixed(4)}, ${vehicle.current_longitude.toFixed(4)}`
                : 'N/A'
            }
          />
        </div>
      </div>

      {/* ===== METRICS GRID + READINESS ===== */}
      <div className="grid grid-cols-12 gap-6">
        {/* Metrics gauges */}
        <div className="col-span-9">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Vehicle Telemetry
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <MetricGauge
                label="Speed"
                value={speed}
                unit="km/h"
                min={0}
                max={200}
                warningThreshold={120}
                criticalThreshold={160}
              />
              <MetricGauge
                label="Fuel Level"
                value={fuelLevel}
                unit="%"
                min={0}
                max={100}
                warningThreshold={25}
                criticalThreshold={10}
                invertThresholds
              />
              <MetricGauge
                label="Engine Temp"
                value={engineTemp}
                unit={'\u00B0C'}
                min={0}
                max={150}
                warningThreshold={100}
                criticalThreshold={120}
              />
              <MetricGauge
                label="Battery"
                value={batteryVoltage}
                unit="V"
                min={0}
                max={15}
                warningThreshold={11.5}
                criticalThreshold={10.5}
                invertThresholds
              />
              <MetricGauge
                label="RPM"
                value={rpm}
                unit="rpm"
                min={0}
                max={8000}
                warningThreshold={6000}
                criticalThreshold={7000}
              />
              <MetricGauge
                label="Oil Pressure"
                value={oilPressure}
                unit="psi"
                min={0}
                max={80}
                warningThreshold={20}
                criticalThreshold={10}
                invertThresholds
              />
              <MetricGauge
                label="Tire Pressure"
                value={tirePressure}
                unit="psi"
                min={0}
                max={50}
                warningThreshold={28}
                criticalThreshold={22}
                invertThresholds
              />
            </div>
          </div>
        </div>

        {/* Readiness score */}
        <div className="col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col items-center justify-center h-full">
            <ReadinessScore
              fuelLevel={fuelLevel}
              equipment={equipment}
              hasCriticalAnomalies={false}
              engineTemp={engineTemp}
              size="lg"
            />
          </div>
        </div>
      </div>

      {/* ===== EQUIPMENT SECTION ===== */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <EquipmentChecklist equipment={equipment} />
      </div>

      {/* ===== LAST UPDATED ===== */}
      <div className="text-center">
        <p className="text-xs text-gray-400">
          Vehicle data updated: {new Date(vehicle.updated_at).toLocaleString()}
          {telemetry.speed?.timestamp && (
            <>
              {' '}&middot; Last telemetry: {new Date(telemetry.speed.timestamp).toLocaleString()}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-semibold text-white mt-0.5">{value}</p>
    </div>
  );
}

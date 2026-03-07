'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Vehicle, VehicleType, VehicleStatus, VEHICLE_TYPE_LABELS } from '@/types';

interface VehicleFormProps {
  vehicle?: Vehicle;
  mode: 'create' | 'edit';
}

const VEHICLE_TYPES: VehicleType[] = [
  'police',
  'ambulance',
  'fire_truck',
  'civil_protection',
  'hybrid',
];

const VEHICLE_STATUSES: { value: VehicleStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'in_service', label: 'In Service' },
  { value: 'en_route', label: 'En Route' },
  { value: 'at_scene', label: 'At Scene' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'offline', label: 'Offline' },
];

export default function VehicleForm({ vehicle, mode }: VehicleFormProps) {
  const router = useRouter();

  const [name, setName] = useState(vehicle?.name ?? '');
  const [plateNumber, setPlateNumber] = useState(vehicle?.plate_number ?? '');
  const [type, setType] = useState<VehicleType>(vehicle?.type ?? 'police');
  const [year, setYear] = useState(vehicle?.year?.toString() ?? new Date().getFullYear().toString());
  const [make, setMake] = useState(vehicle?.make ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [status, setStatus] = useState<VehicleStatus>(vehicle?.status ?? 'available');
  const [specifications, setSpecifications] = useState<Record<string, unknown>>(
    vehicle?.specifications ?? {}
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSpec = (key: string, value: string | number) => {
    setSpecifications((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name,
      plate_number: plateNumber,
      type,
      year: parseInt(year, 10),
      make,
      model,
      status,
      specifications,
    };

    try {
      const url =
        mode === 'create' ? '/api/vehicles' : `/api/vehicles/${vehicle!.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Something went wrong');
      }

      const data = await res.json();
      router.push(`/fleet/${data.id ?? vehicle?.id}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderTypeSpecificFields = () => {
    switch (type) {
      case 'police':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patrol Zone
              </label>
              <input
                type="text"
                value={(specifications.patrol_zone as string) ?? ''}
                onChange={(e) => updateSpec('patrol_zone', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Zone A-12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Radio Channel
              </label>
              <input
                type="text"
                value={(specifications.radio_channel as string) ?? ''}
                onChange={(e) => updateSpec('radio_channel', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. CH-14"
              />
            </div>
          </>
        );

      case 'ambulance':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical Level
              </label>
              <select
                value={(specifications.medical_level as string) ?? 'BLS'}
                onChange={(e) => updateSpec('medical_level', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="BLS">BLS (Basic Life Support)</option>
                <option value="ALS">ALS (Advanced Life Support)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient Capacity
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={(specifications.patient_capacity as number) ?? 1}
                onChange={(e) => updateSpec('patient_capacity', parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </>
        );

      case 'fire_truck':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Water Tank Capacity (L)
              </label>
              <input
                type="number"
                min={0}
                value={(specifications.water_tank_capacity as number) ?? 0}
                onChange={(e) =>
                  updateSpec('water_tank_capacity', parseInt(e.target.value, 10))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. 3000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ladder Length (m)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={(specifications.ladder_length as number) ?? 0}
                onChange={(e) =>
                  updateSpec('ladder_length', parseFloat(e.target.value))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. 30"
              />
            </div>
          </>
        );

      case 'civil_protection':
        return (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Specialization
            </label>
            <input
              type="text"
              value={(specifications.specialization as string) ?? ''}
              onChange={(e) => updateSpec('specialization', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Flood response, Search and rescue"
            />
          </div>
        );

      case 'hybrid':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Function
              </label>
              <input
                type="text"
                value={(specifications.primary_function as string) ?? ''}
                onChange={(e) => updateSpec('primary_function', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Medical transport"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secondary Function
              </label>
              <input
                type="text"
                value={(specifications.secondary_function as string) ?? ''}
                onChange={(e) => updateSpec('secondary_function', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Hazmat containment"
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Core Vehicle Info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Vehicle Information
        </h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Unit Alpha-7"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plate Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. EMR-1234"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={type}
              onChange={(e) => {
                setType(e.target.value as VehicleType);
                setSpecifications({});
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {VEHICLE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={status}
              onChange={(e) => setStatus(e.target.value as VehicleStatus)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {VEHICLE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min={1990}
              max={2030}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Make <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Ford"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Explorer Interceptor"
            />
          </div>
        </div>
      </div>

      {/* Type-Specific Specifications */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Specifications
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Type-specific configuration for{' '}
          <span className="font-medium text-gray-700">
            {VEHICLE_TYPE_LABELS[type]}
          </span>{' '}
          vehicles.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {renderTypeSpecificFields()}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? mode === 'create'
              ? 'Creating...'
              : 'Saving...'
            : mode === 'create'
            ? 'Create Vehicle'
            : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

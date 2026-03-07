'use client';

import { useState, useCallback } from 'react';
import { useMapEvents } from 'react-leaflet';
import type { Vehicle, VehicleType } from '@/types';

// ---------- Haversine ----------

const EARTH_RADIUS_KM = 6371;

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------- Types ----------

interface NearestVehicle {
  vehicle: Vehicle;
  distance: number;
}

interface NearestVehicleFinderProps {
  vehicles: Vehicle[];
}

// ---------- Map click handler (must be child of MapContainer) ----------

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ---------- Main component ----------

export default function NearestVehicleFinder({ vehicles }: NearestVehicleFinderProps) {
  const [isActive, setIsActive] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [nearestVehicles, setNearestVehicles] = useState<NearestVehicle[]>([]);

  const findNearest = useCallback(
    (lat: number, lng: number) => {
      const available = vehicles.filter(
        (v) =>
          v.status === 'available' &&
          v.current_latitude != null &&
          v.current_longitude != null,
      );

      const withDistance = available.map((v) => ({
        vehicle: v,
        distance: haversineDistance(lat, lng, v.current_latitude!, v.current_longitude!),
      }));

      withDistance.sort((a, b) => a.distance - b.distance);
      setNearestVehicles(withDistance.slice(0, 3));
      setSelectedPoint({ lat, lng });
    },
    [vehicles],
  );

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!isActive) return;
      findNearest(lat, lng);
      setManualLat(lat.toFixed(6));
      setManualLng(lng.toFixed(6));
    },
    [isActive, findNearest],
  );

  const handleManualSearch = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      findNearest(lat, lng);
    }
  };

  const TYPE_EMOJI: Record<VehicleType, string> = {
    police: '\uD83D\uDE93',
    ambulance: '\uD83D\uDE91',
    fire_truck: '\uD83D\uDE92',
    civil_protection: '\uD83D\uDEE1\uFE0F',
    hybrid: '\u2699\uFE0F',
  };

  return (
    <>
      {/* Map click handler -- only active when panel is in "click" mode */}
      <MapClickHandler onMapClick={handleMapClick} />

      {/* Panel overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] w-72">
        {/* Toggle button */}
        <button
          onClick={() => {
            setIsActive(!isActive);
            if (isActive) {
              setSelectedPoint(null);
              setNearestVehicles([]);
              setManualLat('');
              setManualLng('');
            }
          }}
          className={`mb-1 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shadow-lg transition-colors ${
            isActive
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {isActive ? 'Finding Nearest...' : 'Find Nearest Vehicle'}
        </button>

        {isActive && (
          <div className="rounded-xl bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200 overflow-hidden">
            {/* Manual input */}
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Click map or enter coordinates
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Lat"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className="w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <input
                  type="text"
                  placeholder="Lng"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  className="w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <button
                  onClick={handleManualSearch}
                  className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Go
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="px-4 py-3">
              {selectedPoint ? (
                <>
                  <p className="mb-2 text-[10px] text-gray-500">
                    From: {selectedPoint.lat.toFixed(4)}, {selectedPoint.lng.toFixed(4)}
                  </p>
                  {nearestVehicles.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      No available vehicles found.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {nearestVehicles.map(({ vehicle, distance }, idx) => (
                        <div
                          key={vehicle.id}
                          className="flex items-center gap-2 rounded-lg bg-gray-50 p-2"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                            {idx + 1}
                          </span>
                          <span className="text-base">
                            {TYPE_EMOJI[vehicle.type] || '\uD83D\uDE97'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">
                              {vehicle.name}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {vehicle.plate_number}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-indigo-600">
                              {distance < 1
                                ? `${Math.round(distance * 1000)} m`
                                : `${distance.toFixed(1)} km`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400 italic text-center py-2">
                  Click anywhere on the map to find nearest available vehicles.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

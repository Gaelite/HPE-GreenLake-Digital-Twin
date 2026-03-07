'use client';

import { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Vehicle, VehicleType, VehicleStatus } from '@/types';
import VehiclePopup from './VehiclePopup';

// ---------- Icon configuration ----------

const TYPE_EMOJI: Record<VehicleType, string> = {
  police: '\uD83D\uDE93',
  ambulance: '\uD83D\uDE91',
  fire_truck: '\uD83D\uDE92',
  civil_protection: '\uD83D\uDEE1\uFE0F',
  hybrid: '\u2699\uFE0F',
};

const TYPE_COLOR: Record<VehicleType, string> = {
  police: '#3B82F6',
  ambulance: '#EF4444',
  fire_truck: '#F97316',
  civil_protection: '#8B5CF6',
  hybrid: '#6B7280',
};

const STATUS_RING: Record<VehicleStatus, string> = {
  available: '#22C55E',
  in_service: '#3B82F6',
  en_route: '#EAB308',
  at_scene: '#F97316',
  maintenance: '#6B7280',
  offline: '#EF4444',
};

function createVehicleIcon(vehicle: Vehicle, hasActiveRoute = false): L.DivIcon {
  const bgColor = TYPE_COLOR[vehicle.type] || '#6B7280';
  const ringColor = STATUS_RING[vehicle.status] || '#6B7280';
  const emoji = TYPE_EMOJI[vehicle.type] || '\uD83D\uDE97';
  const size = 36;

  return L.divIcon({
    className: 'custom-vehicle-icon',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${bgColor};
        border: 3px solid ${ringColor};
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3)${hasActiveRoute ? ', 0 0 0 3px #3B82F6' : ''};
        font-size: 16px;
        cursor: pointer;
        transition: transform 0.2s;
        position: relative;
      " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
        ${emoji}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

// ---------- Component ----------

interface AssignedIncident {
  id: string;
  title: string;
  incident_type: string;
  status: string;
}

interface VehicleMarkerProps {
  vehicle: Vehicle;
  speed?: number | null;
  fuelLevel?: number | null;
  assignedIncident?: AssignedIncident | null;
  /** Called when the user requests the route to be shown/hidden */
  onRouteRequest?: (vehicleId: string) => void;
  /** Whether this vehicle's route is currently displayed on the map */
  hasActiveRoute?: boolean;
  /** Whether the route is currently being fetched */
  isLoadingRoute?: boolean;
}

export default function VehicleMarker({
  vehicle,
  speed,
  fuelLevel,
  assignedIncident,
  onRouteRequest,
  hasActiveRoute = false,
  isLoadingRoute = false,
}: VehicleMarkerProps) {
  const icon = useMemo(
    () => createVehicleIcon(vehicle, hasActiveRoute),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicle.type, vehicle.status, hasActiveRoute]
  );

  if (vehicle.current_latitude == null || vehicle.current_longitude == null) {
    return null;
  }

  return (
    <Marker
      position={[vehicle.current_latitude, vehicle.current_longitude]}
      icon={icon}
    >
      <Popup maxWidth={280} className="vehicle-popup">
        <VehiclePopup vehicle={vehicle} speed={speed} fuelLevel={fuelLevel} assignedIncident={assignedIncident} />
        {vehicle.status === 'en_route' && onRouteRequest && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRouteRequest(vehicle.id);
            }}
            disabled={isLoadingRoute}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              cursor: isLoadingRoute ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: hasActiveRoute ? '#EFF6FF' : '#4F46E5',
              color: hasActiveRoute ? '#3B82F6' : '#fff',
              opacity: isLoadingRoute ? 0.7 : 1,
            }}
          >
            {isLoadingRoute ? (
              <>
                <svg className="animate-spin" style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ opacity: 0.75 }} />
                </svg>
                Fetching route…
              </>
            ) : hasActiveRoute ? (
              '🔵 Hide route'
            ) : (
              '🗺️ Show route on map'
            )}
          </button>
        )}
      </Popup>
    </Marker>
  );
}

'use client';

import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Incident, IncidentType, Severity } from '@/types';

const INCIDENT_EMOJI: Record<IncidentType, string> = {
  fire: '\uD83D\uDD25',
  medical: '\uD83C\uDFE5',
  crime: '\uD83D\uDEA8',
  accident: '\uD83D\uDCA5',
  natural_disaster: '\uD83C\uDF0A',
  road_closure: '\uD83D\uDEA7',
};

const INCIDENT_LABELS: Record<IncidentType, string> = {
  fire: 'Fire',
  medical: 'Medical',
  crime: 'Crime',
  accident: 'Accident',
  natural_disaster: 'Natural Disaster',
  road_closure: 'Road Closure',
};

const SEVERITY_STYLE: Record<Severity, { ring: string; bg: string; text: string }> = {
  info: { ring: 'border-blue-400', bg: 'bg-blue-50', text: 'text-blue-700' },
  warning: { ring: 'border-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  critical: { ring: 'border-red-400', bg: 'bg-red-50', text: 'text-red-700' },
};

const STATUS_LABELS: Record<string, string> = {
  reported: 'Reported',
  dispatched: 'Dispatched',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

interface IncidentMarkerProps {
  incident: Incident;
}

function createIncidentIcon(incident: Incident) {
  const sizeMap: Record<Severity, number> = { info: 28, warning: 32, critical: 36 };
  const size = sizeMap[incident.severity] || 32;
  const colorMap: Record<Severity, string> = {
    info: '#3B82F6',
    warning: '#F59E0B',
    critical: '#EF4444',
  };
  const color = colorMap[incident.severity] || '#EF4444';
  const emoji = INCIDENT_EMOJI[incident.incident_type] || '\u26A0\uFE0F';

  return L.divIcon({
    className: 'custom-incident-icon',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 2px ${color}40;
        font-size: ${size * 0.45}px;
        animation: pulse-ring 2s ease-out infinite;
        position: relative;
      ">
        <span style="filter: brightness(0) invert(1); mix-blend-mode: normal;">${emoji}</span>
      </div>
      <style>
        @keyframes pulse-ring {
          0% { box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 0 ${color}60; }
          70% { box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 12px ${color}00; }
          100% { box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 0 ${color}00; }
        }
      </style>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

interface IncidentMarkerExtraProps {
  /** Called when the marker is clicked — triggers route display for assigned vehicles */
  onRouteRequest?: (vehicleIds: string[]) => void;
}

export default function IncidentMarker({
  incident,
  onRouteRequest,
}: IncidentMarkerProps & IncidentMarkerExtraProps) {
  const icon = createIncidentIcon(incident);
  const severity = SEVERITY_STYLE[incident.severity] || SEVERITY_STYLE.info;
  const assignedIds: string[] = (incident.assigned_vehicle_ids as string[]) ?? [];

  return (
    <Marker
      position={[incident.latitude, incident.longitude]}
      icon={icon}
    >
      <Popup maxWidth={260} className="incident-popup">
        <div className="min-w-[220px] p-1">
          {/* Header */}
          <div className="mb-2 flex items-start gap-2">
            <span className="text-xl">{INCIDENT_EMOJI[incident.incident_type]}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{incident.title}</h3>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${severity.bg} ${severity.text}`}
                >
                  {incident.severity.toUpperCase()}
                </span>
                <span className="text-[10px] text-gray-500">
                  {INCIDENT_LABELS[incident.incident_type]}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {incident.description && (
            <p className="mb-2 text-[11px] leading-relaxed text-gray-600 line-clamp-2">
              {incident.description}
            </p>
          )}

          {/* Details grid */}
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-gray-50 p-1.5">
              <p className="text-[10px] text-gray-500">Status</p>
              <p className="text-xs font-medium text-gray-800">
                {STATUS_LABELS[incident.status] || incident.status}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 p-1.5">
              <p className="text-[10px] text-gray-500">Reported</p>
              <p className="text-xs font-medium text-gray-800">
                {new Date(incident.reported_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {/* Assigned vehicles + Show Routes button */}
          {assignedIds.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="rounded-md bg-blue-50 p-1.5">
                <p className="text-[10px] text-blue-600">
                  {assignedIds.length} vehicle(s) assigned
                </p>
              </div>
              {onRouteRequest && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRouteRequest(assignedIds);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    background: '#4F46E5',
                    color: '#fff',
                  }}
                >
                  🗺️ Show assigned vehicle route(s)
                </button>
              )}
            </div>
          )}

          {/* Coordinates */}
          <div className="mt-2 text-[10px] text-gray-400">
            {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

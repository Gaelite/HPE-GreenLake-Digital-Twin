'use client';

import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Incident } from '@/types';

// ---------- Icon factory ----------

function createTrafficIcon() {
  // Orange diamond with a construction/roadblock SVG — looks nothing like
  // the circular emergency-incident markers so users can tell them apart.
  return L.divIcon({
    className: 'traffic-obstacle-icon',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <!-- Pulsing ring -->
        <div style="
          position: absolute;
          inset: -4px;
          border-radius: 4px;
          transform: rotate(45deg);
          animation: traffic-pulse 2.4s ease-in-out infinite;
          border: 2px solid #ea580c;
          opacity: 0.35;
        "></div>
        <!-- Diamond body -->
        <div style="
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          border: 2.5px solid #fff;
          border-radius: 4px;
          transform: rotate(45deg);
          box-shadow: 0 2px 8px rgba(234,88,12,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <!-- Inner icon (rotated back so it's upright) -->
          <svg style="transform: rotate(-45deg);" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="2" width="6" height="20" rx="1"/>
            <circle cx="12" cy="7" r="1.5" fill="#fff" stroke="none"/>
            <circle cx="12" cy="12" r="1.5" fill="#fff" stroke="none"/>
            <circle cx="12" cy="17" r="1.5" fill="#fff" stroke="none"/>
          </svg>
        </div>
      </div>
      <style>
        @keyframes traffic-pulse {
          0%, 100% { opacity: 0.25; transform: rotate(45deg) scale(1); }
          50%      { opacity: 0.55; transform: rotate(45deg) scale(1.25); }
        }
      </style>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

// ---------- Component ----------

interface TrafficObstacleMarkerProps {
  incident: Incident;
}

export default function TrafficObstacleMarker({ incident }: TrafficObstacleMarkerProps) {
  const icon = createTrafficIcon();

  return (
    <Marker position={[incident.latitude, incident.longitude]} icon={icon}>
      <Popup maxWidth={240} className="traffic-popup">
        <div className="min-w-[200px] p-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-lg">🚧</span>
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {incident.title}
            </h3>
          </div>
          <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 mb-1.5">
            ROAD CLOSURE
          </span>
          {incident.description && (
            <p className="text-[11px] leading-relaxed text-gray-600 line-clamp-2 mb-1.5">
              {incident.description}
            </p>
          )}
          <p className="text-[10px] text-gray-400">
            {Number(incident.latitude).toFixed(4)}, {Number(incident.longitude).toFixed(4)}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

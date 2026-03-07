'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { VehicleEvent, Severity, EventType } from '@/types';

// ----- Severity styling -----
const SEVERITY_DOT_COLORS: Record<Severity, string> = {
  info: 'bg-blue-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
};

const SEVERITY_LINE_COLORS: Record<Severity, string> = {
  info: 'bg-blue-200',
  warning: 'bg-yellow-200',
  critical: 'bg-red-200',
};

const SEVERITY_BADGE: Record<Severity, string> = {
  info: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  warning: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  critical: 'bg-red-50 text-red-700 ring-red-600/20',
};

// ----- Event type labels -----
const EVENT_TYPE_LABELS: Record<EventType, string> = {
  dispatch: 'Dispatch',
  en_route: 'En Route',
  arrived: 'Arrived',
  completed: 'Completed',
  maintenance_alert: 'Maintenance',
  refuel: 'Refuel',
  equipment_check: 'Equipment Check',
};

const EVENT_TYPE_ICONS: Record<EventType, string> = {
  dispatch: '\u{1F6A8}',   // siren
  en_route: '\u{1F697}',   // car
  arrived: '\u{1F4CD}',    // pin
  completed: '\u2705',     // check
  maintenance_alert: '\u{1F527}', // wrench
  refuel: '\u26FD',        // fuel pump
  equipment_check: '\u{1F4CB}',  // clipboard
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface EventTimelineProps {
  vehicleId: string;
  /** Max events to display */
  maxEvents?: number;
}

export default function EventTimeline({ vehicleId, maxEvents = 30 }: EventTimelineProps) {
  const [events, setEvents] = useState<VehicleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial events
  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch(
          `/api/events?vehicle_id=${vehicleId}&limit=${maxEvents}`
        );
        const json = await res.json();
        if (json.data) {
          setEvents(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [vehicleId, maxEvents]);

  // Subscribe to new events in realtime
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`events-timeline-${vehicleId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'INSERT' as const,
          schema: 'public',
          table: 'vehicle_events',
          filter: `vehicle_id=eq.${vehicleId}`,
        },
        (payload: { new: VehicleEvent }) => {
          setEvents((prev) => {
            const updated = [payload.new, ...prev];
            return updated.slice(0, maxEvents);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vehicleId, maxEvents]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-3 h-3 bg-gray-200 rounded-full mt-1" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Event Timeline</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          {events.length} event{events.length !== 1 ? 's' : ''} recorded
        </p>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400 py-12">
            No events recorded yet
          </div>
        ) : (
          <div className="relative">
            {events.map((event, index) => {
              const isLast = index === events.length - 1;
              return (
                <div key={event.id} className="relative flex gap-3 pb-5">
                  {/* Vertical line */}
                  {!isLast && (
                    <div
                      className={`absolute left-[7px] top-4 bottom-0 w-0.5 ${
                        SEVERITY_LINE_COLORS[event.severity]
                      }`}
                    />
                  )}

                  {/* Dot */}
                  <div className="relative flex-shrink-0 mt-1">
                    <div
                      className={`w-[15px] h-[15px] rounded-full border-2 border-white shadow-sm ${
                        SEVERITY_DOT_COLORS[event.severity]
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Event type label */}
                      <span className="text-sm font-medium text-gray-900">
                        {EVENT_TYPE_ICONS[event.event_type]}{' '}
                        {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                      </span>

                      {/* Severity badge */}
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          SEVERITY_BADGE[event.severity]
                        }`}
                      >
                        {event.severity}
                      </span>
                    </div>

                    {/* Description */}
                    {event.description && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {event.description}
                      </p>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-gray-400 font-mono">
                        {formatTimestamp(event.timestamp)}
                      </span>
                      <span className="text-[11px] text-gray-300">
                        {relativeTime(event.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

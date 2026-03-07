'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Insight, InsightStatus } from '@/types';

const SEVERITY_STYLES: Record<string, { card: string; icon: string; badge: string }> = {
  critical: {
    card: 'border-l-4 border-l-red-500 bg-red-50/50',
    icon: 'bg-red-100 text-red-600',
    badge: 'bg-red-100 text-red-700',
  },
  warning: {
    card: 'border-l-4 border-l-amber-500 bg-amber-50/50',
    icon: 'bg-amber-100 text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
  },
  info: {
    card: 'border-l-4 border-l-blue-500 bg-blue-50/50',
    icon: 'bg-blue-100 text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
  },
};

const TYPE_LABELS: Record<string, string> = {
  maintenance_due: 'Maintenance',
  response_time_trend: 'Response Time',
  anomaly_spike: 'Anomaly Spike',
  utilization_alert: 'Utilization',
  fuel_efficiency: 'Fuel',
};

const STATUS_STYLES: Record<InsightStatus, string> = {
  active: 'bg-red-50 text-red-700 ring-red-600/20',
  acknowledged: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  resolved: 'bg-green-50 text-green-700 ring-green-600/20',
};

interface InsightCardProps {
  insight: Insight;
  onDismiss?: (id: string) => void;
  onStatusChange?: (id: string, status: InsightStatus) => void;
  isUnread?: boolean;
}

export default function InsightCard({ insight, onDismiss, onStatusChange, isUnread }: InsightCardProps) {
  const [updatingAction, setUpdatingAction] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<InsightStatus>(insight.status ?? 'active');
  const [isHidden, setIsHidden] = useState(false);

  const styles = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;

  const handleStatusUpdate = async (newStatus: InsightStatus) => {
    setUpdatingAction(newStatus);
    try {
      const res = await fetch('/api/insights/recommendations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: insight.id, status: newStatus }),
      });

      if (res.ok) {
        setLocalStatus(newStatus);
        onStatusChange?.(insight.id, newStatus);
        if (newStatus === 'resolved') {
          setIsHidden(true);
          onDismiss?.(insight.id);
        }
      }
    } catch (err) {
      console.error('Failed to update insight:', err);
    } finally {
      setUpdatingAction(null);
    }
  };

  if (isHidden) return null;

  const timeAgo = formatTimeAgo(insight.created_at);

  return (
    <div
      className={`rounded-lg p-4 shadow-sm transition-all hover:shadow-md ${styles.card} ${isUnread ? 'ring-2 ring-blue-200' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Severity icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${styles.icon}`}
        >
          {insight.severity === 'critical' && (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )}
          {insight.severity === 'warning' && (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {insight.severity === 'info' && (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {isUnread && (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
              </span>
            )}
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {insight.title}
            </h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}>
              {TYPE_LABELS[insight.insight_type] ?? insight.insight_type}
            </span>
            {localStatus !== 'active' && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[localStatus]}`}>
                {localStatus.charAt(0).toUpperCase() + localStatus.slice(1)}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {insight.description}
          </p>

          {/* Actions row */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">{timeAgo}</span>

            {/* Vehicle link */}
            {insight.vehicle_id && (
              <Link
                href={`/fleet/${insight.vehicle_id}`}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                View Vehicle
              </Link>
            )}

            {/* Ack / Resolve buttons */}
            {localStatus === 'active' && (
              <button
                onClick={() => handleStatusUpdate('acknowledged')}
                disabled={updatingAction !== null}
                className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
              >
                {updatingAction === 'acknowledged' && <Spinner />}
                Acknowledge
              </button>
            )}
            {(localStatus === 'active' || localStatus === 'acknowledged') && (
              <button
                onClick={() => handleStatusUpdate('resolved')}
                disabled={updatingAction !== null}
                className="inline-flex items-center rounded-md border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
              >
                {updatingAction === 'resolved' && <Spinner />}
                Resolve
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHr = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

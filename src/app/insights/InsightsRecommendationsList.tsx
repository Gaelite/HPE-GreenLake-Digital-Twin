'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import InsightCard from '@/components/insights/InsightCard';
import type { Insight, Severity } from '@/types';

export default function InsightsRecommendationsList() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const markedReadIdsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInsights = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (filter !== 'all') params.set('severity', filter);

      const res = await fetch(`/api/insights/recommendations?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const fetched: Insight[] = data.insights ?? [];
      setUnreadCount(data.unreadCount ?? 0);
      // Filter out locally dismissed insights
      setInsights(fetched.filter((i) => !dismissedIdsRef.current.has(i.id)));
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
      if (showLoading) setInsights([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [filter]);

  // Initial fetch + re-fetch when filter changes
  useEffect(() => {
    fetchInsights(true);
  }, [fetchInsights]);

  // Poll every 10 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchInsights(false), 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchInsights]);

  // Auto-mark-as-read after 3 seconds
  useEffect(() => {
    if (loading || insights.length === 0) return;

    const unreadIds = insights
      .filter((i) => i.read_at === null && !markedReadIdsRef.current.has(i.id))
      .map((i) => i.id);

    if (unreadIds.length === 0) return;

    markReadTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/insights/recommendations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'markRead', ids: unreadIds }),
        });
        if (res.ok) {
          unreadIds.forEach((id) => markedReadIdsRef.current.add(id));
          setInsights((prev) =>
            prev.map((i) =>
              unreadIds.includes(i.id) ? { ...i, read_at: new Date().toISOString() } : i
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - unreadIds.length));
        }
      } catch (err) {
        console.error('Failed to mark insights as read:', err);
      }
    }, 3000);

    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    };
  }, [loading, insights]);

  const handleDismiss = (id: string) => {
    dismissedIdsRef.current.add(id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Automated Recommendations
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              AI-generated insights based on fleet telemetry, events, and anomaly patterns
            </p>
          </div>
          {unreadCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {unreadCount} new
            </span>
          )}
        </div>

        {/* Severity filter */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors capitalize ${
                filter === sev
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg bg-gray-50 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-gray-200" />
                  <div className="h-3 w-full rounded bg-gray-100" />
                  <div className="h-3 w-24 rounded bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <svg className="h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">No active recommendations</p>
          <p className="text-xs mt-1">All clear! No issues detected in the fleet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onDismiss={handleDismiss}
              isUnread={insight.read_at === null && !markedReadIdsRef.current.has(insight.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

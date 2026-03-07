'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import InsightCard from '@/components/insights/InsightCard';
import type { Insight } from '@/types';

export default function CompactInsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInsights = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/insights/recommendations?limit=5');
      if (!res.ok) return;
      const data = await res.json();
      const fetched: Insight[] = data.insights ?? [];
      setUnreadCount(data.unreadCount ?? 0);
      setInsights(fetched.filter((i) => !dismissedIdsRef.current.has(i.id)));
    } catch {
      // silently ignore polling errors
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights(true);
  }, [fetchInsights]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchInsights(false), 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchInsights]);

  const handleDismiss = (id: string) => {
    dismissedIdsRef.current.add(id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="flex h-full flex-col rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Recent Insights</h3>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              {unreadCount} new
            </span>
          )}
        </div>
        <Link
          href="/insights"
          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          View All
        </Link>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg bg-gray-50 p-4 h-20" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <svg className="h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-medium">No active insights</p>
          </div>
        ) : (
          <div className="space-y-2">
            {insights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onDismiss={handleDismiss}
                isUnread={insight.read_at === null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface AlertBannerProps {
  criticalCount: number;
}

/**
 * AlertBanner — Top banner showing critical alert count.
 * Red background, dismissible, links to /alerts.
 * Polls every 5s for live critical count updates.
 */
export default function AlertBanner({ criticalCount: initialCount }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [criticalCount, setCriticalCount] = useState(initialCount);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function pollCriticalCount() {
      try {
        const res = await fetch('/api/anomalies?severity=critical&status=active&limit=1');
        if (!res.ok) return;
        const data = await res.json();
        const count = data.count ?? data.data?.length ?? 0;
        setCriticalCount(count);
        if (count > 0) setDismissed(false);
      } catch {
        // silently ignore polling errors
      }
    }

    intervalRef.current = setInterval(pollCriticalCount, 5_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (dismissed || criticalCount === 0) return null;

  return (
    <div className="relative rounded-lg bg-red-600 px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Alert Icon */}
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-white"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.345 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Message */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">
              {criticalCount} Critical Alert{criticalCount !== 1 ? 's' : ''}
            </span>
            <span className="text-red-100">
              requiring immediate attention
            </span>
          </div>

          {/* Link to Alerts */}
          <Link
            href="/alerts?severity=critical&status=active"
            className="ml-2 inline-flex items-center rounded-md bg-red-700 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-red-800"
          >
            View Alerts
            <svg
              className="ml-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 rounded-md p-1.5 text-red-200 transition-colors hover:bg-red-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Dismiss alert banner"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

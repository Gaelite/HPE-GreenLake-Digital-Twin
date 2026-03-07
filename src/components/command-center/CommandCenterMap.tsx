'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const FleetMap = dynamic(() => import('@/components/map/FleetMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 rounded-xl">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
        <p className="text-xs text-gray-400">Loading map...</p>
      </div>
    </div>
  ),
});

export default function CommandCenterMap() {
  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden ring-1 ring-gray-200 shadow-sm">
      <FleetMap showControls={false} />
      <Link
        href="/map"
        className="absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md backdrop-blur-sm ring-1 ring-gray-200 transition-all hover:bg-white hover:shadow-lg"
      >
        Open Full Map
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </Link>
    </div>
  );
}

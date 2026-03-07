"use client";

import dynamic from "next/dynamic";
import AppShell from "@/components/layout/AppShell";

const FleetMap = dynamic(() => import("@/components/map/FleetMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-400">Loading map...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  return (
    <AppShell>
      <div className="relative -m-6 h-[calc(100vh-0px)] w-[calc(100%+3rem)]">
        <FleetMap />
      </div>
    </AppShell>
  );
}

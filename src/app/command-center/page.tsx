'use client';

import AppShell from '@/components/layout/AppShell';
import AlertBanner from '@/components/anomaly/AlertBanner';
import MiniKPIStrip from '@/components/command-center/MiniKPIStrip';
import CompactAlertPanel from '@/components/command-center/CompactAlertPanel';
import CompactInsightsPanel from '@/components/command-center/CompactInsightsPanel';
import CommandCenterMap from '@/components/command-center/CommandCenterMap';

export default function CommandCenterPage() {
  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-48px)] -m-6 p-4 gap-3">
        {/* Alert banner — self-polls, auto-shows when critical alerts exist */}
        <div className="shrink-0">
          <AlertBanner criticalCount={0} />
        </div>

        {/* KPI strip */}
        <div className="shrink-0">
          <MiniKPIStrip />
        </div>

        {/* Main grid: map + right panels */}
        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-5 gap-3">
          {/* Map — 3/5 width on xl */}
          <div className="xl:col-span-3 min-h-[400px] xl:min-h-0">
            <CommandCenterMap />
          </div>

          {/* Right column — 2/5 width on xl */}
          <div className="xl:col-span-2 flex flex-col gap-3 min-h-[500px] xl:min-h-0">
            {/* Active Alerts — 60% of right column */}
            <div className="flex-[3] min-h-0">
              <CompactAlertPanel />
            </div>
            {/* Recent Insights — 40% of right column */}
            <div className="flex-[2] min-h-0">
              <CompactInsightsPanel />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

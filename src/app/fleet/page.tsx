import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';
import FleetPageClient from './FleetPageClient';
import type { Vehicle } from '@/types';

export const metadata: Metadata = { title: 'Fleet Management' };
export const dynamic = 'force-dynamic';

export default async function FleetPage() {
  const supabase = await createClient();

  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching vehicles:', error);
  }

  return (
    <AppShell>
      <FleetPageClient vehicles={(vehicles as Vehicle[]) ?? []} />
    </AppShell>
  );
}

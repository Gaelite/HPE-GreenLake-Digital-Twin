'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface VehicleDetailClientProps {
  vehicleId: string;
}

export default function VehicleDetailClient({ vehicleId }: VehicleDetailClientProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this vehicle? This action cannot be undone.'
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete vehicle');
        return;
      }

      router.push('/fleet');
      router.refresh();
    } catch {
      alert('An unexpected error occurred');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {deleting ? 'Deleting...' : 'Delete Vehicle'}
    </button>
  );
}

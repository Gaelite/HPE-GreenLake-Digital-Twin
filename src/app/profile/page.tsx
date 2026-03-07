'use client';

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types';

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  dispatcher: 'bg-blue-100 text-blue-700',
  operator: 'bg-green-100 text-green-700',
  viewer: 'bg-gray-100 text-gray-700',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  dispatcher: 'Dispatcher',
  operator: 'Operator',
  viewer: 'Viewer',
};

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        setSaveMessage({ type: 'error', text: error.message });
      } else {
        setSaveMessage({
          type: 'success',
          text: 'Profile updated successfully.',
        });
      }
    } catch {
      setSaveMessage({
        type: 'error',
        text: 'An unexpected error occurred.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile || !user) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      </AppShell>
    );
  }

  const initials = profile.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  const memberSince = new Date(profile.created_at).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your account settings and personal information
          </p>
        </div>

        {/* Profile overview card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white text-xl font-bold">
                {initials}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {profile.full_name || 'No name set'}
              </h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${
                    ROLE_BADGE_STYLES[profile.role]
                  }`}
                >
                  {ROLE_LABELS[profile.role]}
                </span>
                <span className="text-xs text-gray-400">
                  Member since {memberSince}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit name form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Personal Information
          </h3>

          {saveMessage && (
            <div
              className={`rounded-lg p-4 text-sm mb-4 ${
                saveMessage.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {saveMessage.text}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={user.email ?? ''}
                disabled
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-gray-500 text-sm cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-400">
                Email cannot be changed
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Role & permissions info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Role & Permissions
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Current role</span>
              <span
                className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${
                  ROLE_BADGE_STYLES[profile.role]
                }`}
              >
                {ROLE_LABELS[profile.role]}
              </span>
            </div>
            <div className="border-t border-gray-100" />
            <p className="text-xs text-gray-400">
              Your role determines which features you can access. Contact an
              administrator to request a role change.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

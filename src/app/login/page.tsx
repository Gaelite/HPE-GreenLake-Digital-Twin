'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { createClient } from '@/lib/supabase/client';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [exchanging, setExchanging] = useState(false);

  // Handle auth code exchange (email confirmation, magic link, etc.)
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) return;

    setExchanging(true);
    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (!error) {
        const redirect = searchParams.get('redirect') || '/dashboard';
        window.location.href = redirect === '/' ? '/dashboard' : redirect;
      } else {
        setExchanging(false);
      }
    });
  }, [searchParams, router]);

  if (exchanging) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-sm text-gray-500">Confirming your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <img
            src="/icon-192.png"
            alt="Emergency Twin"
            width={56}
            height={56}
            className="mx-auto mb-4 rounded-2xl shadow-lg"
          />
          <h1 className="text-2xl font-bold text-gray-900">Emergency Twin</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Digital Twin for Emergency Vehicle Fleet Management
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Sign in to your account to continue
            </p>
          </div>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Emergency Vehicle Digital Twin POC
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

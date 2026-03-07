'use client';

import SignUpForm from '@/components/auth/SignUpForm';

export default function SignUpPage() {
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
              Create your account
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Get started with Emergency Twin
            </p>
          </div>
          <SignUpForm />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Emergency Vehicle Digital Twin POC
        </p>
      </div>
    </div>
  );
}

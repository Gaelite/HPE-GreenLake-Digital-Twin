'use client';

import React from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
};

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`} role="status">
      <div
        className={`
          animate-spin rounded-full
          border-gray-200 border-t-blue-600
          ${SIZE_CLASSES[size]}
        `}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export default LoadingSpinner;

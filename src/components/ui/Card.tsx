'use client';

import React from 'react';

export interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export function Card({
  title,
  subtitle,
  children,
  className = '',
  headerAction,
}: CardProps) {
  const hasHeader = title || subtitle || headerAction;

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}
    >
      {hasHeader && (
        <div className="flex items-start justify-between px-6 pt-5 pb-0">
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-base font-semibold text-gray-900 truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-sm text-gray-500 truncate">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && (
            <div className="ml-4 flex-shrink-0">{headerAction}</div>
          )}
        </div>
      )}
      <div className={hasHeader ? 'px-6 py-4' : 'p-6'}>{children}</div>
    </div>
  );
}

export default Card;

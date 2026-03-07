'use client';

interface RiskScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * RiskScoreBadge — Displays a vehicle's risk score as a colored badge.
 *
 * Color thresholds:
 *  - Green:  0–30  (low risk)
 *  - Yellow: 31–60 (moderate risk)
 *  - Orange: 61–80 (high risk)
 *  - Red:    81–100 (critical risk)
 */
export default function RiskScoreBadge({
  score,
  size = 'md',
  showLabel = true,
}: RiskScoreBadgeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));

  // ----- Determine color based on score -----
  const getColorClasses = () => {
    if (clampedScore <= 30) {
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        ring: 'ring-green-600/20',
        dot: 'bg-green-500',
        label: 'Low',
      };
    }
    if (clampedScore <= 60) {
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        ring: 'ring-yellow-600/20',
        dot: 'bg-yellow-500',
        label: 'Moderate',
      };
    }
    if (clampedScore <= 80) {
      return {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        ring: 'ring-orange-600/20',
        dot: 'bg-orange-500',
        label: 'High',
      };
    }
    return {
      bg: 'bg-red-100',
      text: 'text-red-800',
      ring: 'ring-red-600/20',
      dot: 'bg-red-500',
      label: 'Critical',
    };
  };

  const colors = getColorClasses();

  // ----- Size variants -----
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${colors.bg} ${colors.text} ${colors.ring} ${sizeClasses[size]}`}
      title={`Risk Score: ${clampedScore}/100 (${colors.label})`}
    >
      <span className={`rounded-full ${colors.dot} ${dotSizes[size]}`} />
      <span>{clampedScore}</span>
      {showLabel && (
        <span className="font-normal opacity-75">
          {colors.label}
        </span>
      )}
    </span>
  );
}

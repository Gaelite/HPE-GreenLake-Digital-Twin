import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import RiskScoreBadge from '@/components/anomaly/RiskScoreBadge';
import AlertBanner from '@/components/anomaly/AlertBanner';

// ============================================================
// Mocks
// ============================================================

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }) }) }),
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: () => {},
  }),
}));

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ============================================================
// RiskScoreBadge
// ============================================================

describe('RiskScoreBadge', () => {
  // ----------------------------------------------------------
  // Basic rendering
  // ----------------------------------------------------------

  it('renders the numeric score text', () => {
    render(<RiskScoreBadge score={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders the risk label by default', () => {
    render(<RiskScoreBadge score={42} />);
    expect(screen.getByText('Moderate')).toBeInTheDocument();
  });

  it('hides the risk label when showLabel is false', () => {
    render(<RiskScoreBadge score={42} showLabel={false} />);
    expect(screen.queryByText('Moderate')).not.toBeInTheDocument();
  });

  it('displays the title attribute with score and label', () => {
    render(<RiskScoreBadge score={42} />);
    const badge = screen.getByTitle('Risk Score: 42/100 (Moderate)');
    expect(badge).toBeInTheDocument();
  });

  // ----------------------------------------------------------
  // Color thresholds — Green (0–30, Low)
  // ----------------------------------------------------------

  describe('green / low risk (0–30)', () => {
    it('applies green styling for score 0', () => {
      render(<RiskScoreBadge score={0} />);
      const badge = screen.getByTitle('Risk Score: 0/100 (Low)');
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-800');
    });

    it('applies green styling for score 15', () => {
      render(<RiskScoreBadge score={15} />);
      const badge = screen.getByTitle('Risk Score: 15/100 (Low)');
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-800');
    });

    it('applies green styling for score 30 (upper boundary)', () => {
      render(<RiskScoreBadge score={30} />);
      const badge = screen.getByTitle('Risk Score: 30/100 (Low)');
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-800');
    });

    it('shows "Low" label for score in green range', () => {
      render(<RiskScoreBadge score={20} />);
      expect(screen.getByText('Low')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // Color thresholds — Yellow (31–60, Moderate)
  // ----------------------------------------------------------

  describe('yellow / moderate risk (31–60)', () => {
    it('applies yellow styling for score 31 (lower boundary)', () => {
      render(<RiskScoreBadge score={31} />);
      const badge = screen.getByTitle('Risk Score: 31/100 (Moderate)');
      expect(badge).toHaveClass('bg-yellow-100');
      expect(badge).toHaveClass('text-yellow-800');
    });

    it('applies yellow styling for score 45', () => {
      render(<RiskScoreBadge score={45} />);
      const badge = screen.getByTitle('Risk Score: 45/100 (Moderate)');
      expect(badge).toHaveClass('bg-yellow-100');
      expect(badge).toHaveClass('text-yellow-800');
    });

    it('applies yellow styling for score 60 (upper boundary)', () => {
      render(<RiskScoreBadge score={60} />);
      const badge = screen.getByTitle('Risk Score: 60/100 (Moderate)');
      expect(badge).toHaveClass('bg-yellow-100');
      expect(badge).toHaveClass('text-yellow-800');
    });

    it('shows "Moderate" label for score in yellow range', () => {
      render(<RiskScoreBadge score={50} />);
      expect(screen.getByText('Moderate')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // Color thresholds — Orange (61–80, High)
  // ----------------------------------------------------------

  describe('orange / high risk (61–80)', () => {
    it('applies orange styling for score 61 (lower boundary)', () => {
      render(<RiskScoreBadge score={61} />);
      const badge = screen.getByTitle('Risk Score: 61/100 (High)');
      expect(badge).toHaveClass('bg-orange-100');
      expect(badge).toHaveClass('text-orange-800');
    });

    it('applies orange styling for score 70', () => {
      render(<RiskScoreBadge score={70} />);
      const badge = screen.getByTitle('Risk Score: 70/100 (High)');
      expect(badge).toHaveClass('bg-orange-100');
      expect(badge).toHaveClass('text-orange-800');
    });

    it('applies orange styling for score 80 (upper boundary)', () => {
      render(<RiskScoreBadge score={80} />);
      const badge = screen.getByTitle('Risk Score: 80/100 (High)');
      expect(badge).toHaveClass('bg-orange-100');
      expect(badge).toHaveClass('text-orange-800');
    });

    it('shows "High" label for score in orange range', () => {
      render(<RiskScoreBadge score={75} />);
      expect(screen.getByText('High')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // Color thresholds — Red (81–100, Critical)
  // ----------------------------------------------------------

  describe('red / critical risk (81–100)', () => {
    it('applies red styling for score 81 (lower boundary)', () => {
      render(<RiskScoreBadge score={81} />);
      const badge = screen.getByTitle('Risk Score: 81/100 (Critical)');
      expect(badge).toHaveClass('bg-red-100');
      expect(badge).toHaveClass('text-red-800');
    });

    it('applies red styling for score 90', () => {
      render(<RiskScoreBadge score={90} />);
      const badge = screen.getByTitle('Risk Score: 90/100 (Critical)');
      expect(badge).toHaveClass('bg-red-100');
      expect(badge).toHaveClass('text-red-800');
    });

    it('applies red styling for score 100 (maximum)', () => {
      render(<RiskScoreBadge score={100} />);
      const badge = screen.getByTitle('Risk Score: 100/100 (Critical)');
      expect(badge).toHaveClass('bg-red-100');
      expect(badge).toHaveClass('text-red-800');
    });

    it('shows "Critical" label for score in red range', () => {
      render(<RiskScoreBadge score={95} />);
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // Score clamping
  // ----------------------------------------------------------

  describe('score clamping', () => {
    it('clamps negative scores to 0', () => {
      render(<RiskScoreBadge score={-10} />);
      expect(screen.getByText('0')).toBeInTheDocument();
      const badge = screen.getByTitle('Risk Score: 0/100 (Low)');
      expect(badge).toHaveClass('bg-green-100');
    });

    it('clamps scores above 100 to 100', () => {
      render(<RiskScoreBadge score={150} />);
      expect(screen.getByText('100')).toBeInTheDocument();
      const badge = screen.getByTitle('Risk Score: 100/100 (Critical)');
      expect(badge).toHaveClass('bg-red-100');
    });
  });

  // ----------------------------------------------------------
  // Size variants
  // ----------------------------------------------------------

  describe('size variants', () => {
    it('applies small size classes for size="sm"', () => {
      render(<RiskScoreBadge score={50} size="sm" />);
      const badge = screen.getByTitle('Risk Score: 50/100 (Moderate)');
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
    });

    it('applies medium size classes by default', () => {
      render(<RiskScoreBadge score={50} />);
      const badge = screen.getByTitle('Risk Score: 50/100 (Moderate)');
      expect(badge).toHaveClass('px-2.5', 'py-1', 'text-sm');
    });

    it('applies large size classes for size="lg"', () => {
      render(<RiskScoreBadge score={50} size="lg" />);
      const badge = screen.getByTitle('Risk Score: 50/100 (Moderate)');
      expect(badge).toHaveClass('px-3', 'py-1.5', 'text-base');
    });
  });
});

// ============================================================
// AlertBanner
// ============================================================

describe('AlertBanner', () => {
  // ----------------------------------------------------------
  // Basic rendering
  // ----------------------------------------------------------

  it('renders the critical alert count (singular)', () => {
    render(<AlertBanner criticalCount={1} />);
    expect(screen.getByText('1 Critical Alert')).toBeInTheDocument();
  });

  it('renders the critical alert count (plural)', () => {
    render(<AlertBanner criticalCount={5} />);
    expect(screen.getByText('5 Critical Alerts')).toBeInTheDocument();
  });

  it('renders the "requiring immediate attention" message', () => {
    render(<AlertBanner criticalCount={3} />);
    expect(
      screen.getByText('requiring immediate attention')
    ).toBeInTheDocument();
  });

  // ----------------------------------------------------------
  // Critical styling
  // ----------------------------------------------------------

  it('applies red background styling for the banner', () => {
    const { container } = render(<AlertBanner criticalCount={2} />);
    const banner = container.firstChild as HTMLElement;
    expect(banner).toHaveClass('bg-red-600');
  });

  it('renders the alert message text in white', () => {
    render(<AlertBanner criticalCount={2} />);
    const alertText = screen.getByText('2 Critical Alerts');
    expect(alertText).toHaveClass('text-white');
  });

  // ----------------------------------------------------------
  // "View Alerts" link
  // ----------------------------------------------------------

  it('renders a "View Alerts" link', () => {
    render(<AlertBanner criticalCount={3} />);
    const link = screen.getByText('View Alerts');
    expect(link).toBeInTheDocument();
  });

  it('links to the alerts page with critical severity filter', () => {
    render(<AlertBanner criticalCount={3} />);
    const link = screen.getByText('View Alerts');
    expect(link.closest('a')).toHaveAttribute(
      'href',
      '/alerts?severity=critical&status=active'
    );
  });

  // ----------------------------------------------------------
  // Dismiss button
  // ----------------------------------------------------------

  it('renders a dismiss button with accessible label', () => {
    render(<AlertBanner criticalCount={2} />);
    const dismissButton = screen.getByRole('button', {
      name: 'Dismiss alert banner',
    });
    expect(dismissButton).toBeInTheDocument();
  });

  it('hides the banner after clicking the dismiss button', () => {
    const { container } = render(<AlertBanner criticalCount={2} />);

    // Banner is visible before dismissal
    expect(screen.getByText('2 Critical Alerts')).toBeInTheDocument();

    const dismissButton = screen.getByRole('button', {
      name: 'Dismiss alert banner',
    });
    fireEvent.click(dismissButton);

    // Banner is gone after dismissal
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('2 Critical Alerts')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------
  // Zero count — nothing rendered
  // ----------------------------------------------------------

  it('renders nothing when criticalCount is 0', () => {
    const { container } = render(<AlertBanner criticalCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  // ----------------------------------------------------------
  // Pluralization edge cases
  // ----------------------------------------------------------

  it('uses singular "Alert" for exactly 1 critical alert', () => {
    render(<AlertBanner criticalCount={1} />);
    expect(screen.getByText('1 Critical Alert')).toBeInTheDocument();
    expect(screen.queryByText('1 Critical Alerts')).not.toBeInTheDocument();
  });

  it('uses plural "Alerts" for more than 1 critical alert', () => {
    render(<AlertBanner criticalCount={12} />);
    expect(screen.getByText('12 Critical Alerts')).toBeInTheDocument();
  });
});

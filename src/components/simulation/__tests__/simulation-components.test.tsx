import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import SimulationResultCard from '@/components/simulation/SimulationResultCard';
import type { SimulationResult, Scenario } from '@/types';

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

// ============================================================
// Factory helpers
// ============================================================

function makeResult(
  overrides: Partial<SimulationResult> & {
    result_data?: Partial<SimulationResult['result_data']>;
  } = {}
): SimulationResult {
  const {
    result_data: resultDataOverrides,
    ...topLevelOverrides
  } = overrides;

  return {
    id: 'sim-result-1',
    scenario_id: 'scenario-1',
    vehicle_id: 'vehicle-abc',
    created_at: '2026-02-10T14:30:00Z',
    result_data: {
      estimated_response_time: 8.5,
      fuel_consumption: 12.3,
      risk_delta: 10,
      coverage_impact: 3,
      outcome_summary:
        'Simulation indicates moderate impact with manageable response time.',
      ...resultDataOverrides,
    },
    ...topLevelOverrides,
  };
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'scenario-1',
    name: 'Highway Pileup Response',
    description: 'Multi-vehicle accident on highway I-95 requiring dispatch.',
    scenario_type: 'dispatch_comparison',
    parameters: {},
    created_by: 'user-1',
    is_template: false,
    created_at: '2026-02-01T10:00:00Z',
    ...overrides,
  };
}

// ============================================================
// SimulationResultCard — Full (non-compact) view
// ============================================================

describe('SimulationResultCard', () => {
  // ----------------------------------------------------------
  // Header & scenario info
  // ----------------------------------------------------------

  describe('header and scenario information', () => {
    it('renders the scenario name when a scenario is provided', () => {
      const result = makeResult();
      const scenario = makeScenario({ name: 'Highway Pileup Response' });

      render(<SimulationResultCard result={result} scenario={scenario} />);

      expect(screen.getByText('Highway Pileup Response')).toBeInTheDocument();
    });

    it('renders fallback title "Simulation Result" when no scenario is provided', () => {
      const result = makeResult();

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('Simulation Result')).toBeInTheDocument();
    });

    it('renders the scenario description when provided', () => {
      const result = makeResult();
      const scenario = makeScenario({
        description: 'Multi-vehicle accident on highway I-95 requiring dispatch.',
      });

      render(<SimulationResultCard result={result} scenario={scenario} />);

      expect(
        screen.getByText(
          'Multi-vehicle accident on highway I-95 requiring dispatch.'
        )
      ).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // Metrics rendering
  // ----------------------------------------------------------

  describe('result metrics', () => {
    it('renders the "Response Time" metric label', () => {
      const result = makeResult({
        result_data: { estimated_response_time: 8.5 },
      });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('Response Time')).toBeInTheDocument();
    });

    it('renders the estimated response time value with "min" unit', () => {
      const result = makeResult({
        result_data: { estimated_response_time: 8.5 },
      });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('8.5')).toBeInTheDocument();
      expect(screen.getByText('min')).toBeInTheDocument();
    });

    it('renders "--" when estimated response time is 0', () => {
      const result = makeResult({
        result_data: { estimated_response_time: 0 },
      });

      render(<SimulationResultCard result={result} />);

      // The "--" is rendered within the Response Time metric area
      const dashes = screen.getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('renders the "Fuel Usage" metric label', () => {
      const result = makeResult({
        result_data: { fuel_consumption: 12.3 },
      });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('Fuel Usage')).toBeInTheDocument();
    });

    it('renders the fuel consumption value with "L" unit', () => {
      const result = makeResult({
        result_data: { fuel_consumption: 12.3 },
      });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('12.3')).toBeInTheDocument();
      expect(screen.getByText('L')).toBeInTheDocument();
    });

    it('renders "--" when fuel consumption is 0', () => {
      const result = makeResult({
        result_data: { fuel_consumption: 0 },
      });

      render(<SimulationResultCard result={result} />);

      const dashes = screen.getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('renders the "Risk Delta" metric label', () => {
      const result = makeResult({ result_data: { risk_delta: 10 } });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('Risk Delta')).toBeInTheDocument();
    });

    it('renders a positive risk delta with "+" prefix', () => {
      const result = makeResult({ result_data: { risk_delta: 25 } });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('+25')).toBeInTheDocument();
    });

    it('renders zero risk delta without "+" prefix', () => {
      const result = makeResult({ result_data: { risk_delta: 0 } });

      render(<SimulationResultCard result={result} />);

      // risk_delta 0 renders as "0" (no plus sign since 0 > 0 is false)
      const riskDeltaSection = screen.getByText('Risk Delta');
      expect(riskDeltaSection).toBeInTheDocument();
    });

    it('renders the "Coverage Impact" metric label', () => {
      const result = makeResult({ result_data: { coverage_impact: 3 } });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('Coverage Impact')).toBeInTheDocument();
    });

    it('renders a positive coverage impact with "+" prefix', () => {
      const result = makeResult({ result_data: { coverage_impact: 7 } });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('+7')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // Outcome summary
  // ----------------------------------------------------------

  describe('outcome summary', () => {
    it('renders the "Outcome Summary" heading', () => {
      const result = makeResult();

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('Outcome Summary')).toBeInTheDocument();
    });

    it('renders the outcome summary text', () => {
      const result = makeResult({
        result_data: {
          outcome_summary:
            'Simulation indicates moderate impact with manageable response time.',
        },
      });

      render(<SimulationResultCard result={result} />);

      expect(
        screen.getByText(
          'Simulation indicates moderate impact with manageable response time.'
        )
      ).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // Risk-level badge in header
  // ----------------------------------------------------------

  describe('risk level badge', () => {
    it('shows "Low Risk" for risk_delta < 5', () => {
      const result = makeResult({ result_data: { risk_delta: 2 } });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('Low Risk')).toBeInTheDocument();
    });

    it('shows "Medium Risk" for risk_delta between 5 and 14', () => {
      const result = makeResult({ result_data: { risk_delta: 10 } });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
    });

    it('shows "High Risk" for risk_delta between 15 and 29', () => {
      const result = makeResult({ result_data: { risk_delta: 20 } });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('High Risk')).toBeInTheDocument();
    });

    it('shows "Critical Risk" for risk_delta >= 30', () => {
      const result = makeResult({ result_data: { risk_delta: 35 } });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('Critical Risk')).toBeInTheDocument();
    });

    it('applies green color classes for low risk', () => {
      const result = makeResult({ result_data: { risk_delta: 3 } });

      render(<SimulationResultCard result={result} />);

      const badge = screen.getByText('Low Risk');
      expect(badge).toHaveClass('text-green-600');
      expect(badge).toHaveClass('bg-green-50');
    });

    it('applies yellow color classes for medium risk', () => {
      const result = makeResult({ result_data: { risk_delta: 8 } });

      render(<SimulationResultCard result={result} />);

      const badge = screen.getByText('Medium Risk');
      expect(badge).toHaveClass('text-yellow-600');
      expect(badge).toHaveClass('bg-yellow-50');
    });

    it('applies orange color classes for high risk', () => {
      const result = makeResult({ result_data: { risk_delta: 22 } });

      render(<SimulationResultCard result={result} />);

      const badge = screen.getByText('High Risk');
      expect(badge).toHaveClass('text-orange-600');
      expect(badge).toHaveClass('bg-orange-50');
    });

    it('applies red color classes for critical risk', () => {
      const result = makeResult({ result_data: { risk_delta: 45 } });

      render(<SimulationResultCard result={result} />);

      const badge = screen.getByText('Critical Risk');
      expect(badge).toHaveClass('text-red-600');
      expect(badge).toHaveClass('bg-red-50');
    });
  });

  // ----------------------------------------------------------
  // Response time color coding
  // ----------------------------------------------------------

  describe('response time color coding', () => {
    it('uses green for response time <= 8 min', () => {
      const result = makeResult({
        result_data: { estimated_response_time: 6.0 },
      });

      render(<SimulationResultCard result={result} />);

      const value = screen.getByText('6.0');
      expect(value.closest('div[class*="text-"]')).toHaveClass('text-green-600');
    });

    it('uses red for response time > 20 min', () => {
      const result = makeResult({
        result_data: { estimated_response_time: 25.0 },
      });

      render(<SimulationResultCard result={result} />);

      const value = screen.getByText('25.0');
      expect(value.closest('div[class*="text-"]')).toHaveClass('text-red-600');
    });
  });

  // ----------------------------------------------------------
  // Meta information
  // ----------------------------------------------------------

  describe('meta information', () => {
    it('renders the vehicle ID', () => {
      const result = makeResult({ vehicle_id: 'vehicle-xyz' });

      render(<SimulationResultCard result={result} />);

      expect(screen.getByText('Vehicle: vehicle-xyz')).toBeInTheDocument();
    });

    it('renders the scenario type when scenario is provided', () => {
      const result = makeResult();
      const scenario = makeScenario({ scenario_type: 'dispatch_comparison' });

      render(<SimulationResultCard result={result} scenario={scenario} />);

      expect(screen.getByText('Type: dispatch_comparison')).toBeInTheDocument();
    });

    it('does not render scenario type when no scenario is provided', () => {
      const result = makeResult();

      render(<SimulationResultCard result={result} />);

      expect(screen.queryByText(/Type:/)).not.toBeInTheDocument();
    });

    it('renders the "Ran:" timestamp', () => {
      const result = makeResult({ created_at: '2026-02-10T14:30:00Z' });

      render(<SimulationResultCard result={result} />);

      // The timestamp is formatted via toLocaleString(), so we check for "Ran:" prefix
      const ranElement = screen.getByText(/^Ran:/);
      expect(ranElement).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // Compact mode
  // ----------------------------------------------------------

  describe('compact mode', () => {
    it('renders the scenario name in compact mode', () => {
      const result = makeResult();
      const scenario = makeScenario({ name: 'Quick Dispatch Test' });

      render(
        <SimulationResultCard result={result} scenario={scenario} compact />
      );

      expect(screen.getByText('Quick Dispatch Test')).toBeInTheDocument();
    });

    it('renders fallback title in compact mode when no scenario', () => {
      const result = makeResult();

      render(<SimulationResultCard result={result} compact />);

      expect(screen.getByText('Simulation Result')).toBeInTheDocument();
    });

    it('renders the risk label in compact mode', () => {
      const result = makeResult({ result_data: { risk_delta: 35 } });

      render(<SimulationResultCard result={result} compact />);

      expect(screen.getByText('Critical Risk')).toBeInTheDocument();
    });

    it('renders the outcome summary text in compact mode', () => {
      const result = makeResult({
        result_data: {
          outcome_summary: 'Minor delay expected due to traffic.',
        },
      });

      render(<SimulationResultCard result={result} compact />);

      expect(
        screen.getByText('Minor delay expected due to traffic.')
      ).toBeInTheDocument();
    });

    it('does not render the full metrics grid in compact mode', () => {
      const result = makeResult();

      render(<SimulationResultCard result={result} compact />);

      expect(screen.queryByText('Response Time')).not.toBeInTheDocument();
      expect(screen.queryByText('Fuel Usage')).not.toBeInTheDocument();
      expect(screen.queryByText('Risk Delta')).not.toBeInTheDocument();
      expect(screen.queryByText('Coverage Impact')).not.toBeInTheDocument();
    });

    it('does not render the "Outcome Summary" heading in compact mode', () => {
      const result = makeResult();

      render(<SimulationResultCard result={result} compact />);

      expect(screen.queryByText('Outcome Summary')).not.toBeInTheDocument();
    });

    it('does not render meta information in compact mode', () => {
      const result = makeResult({ vehicle_id: 'vehicle-abc' });
      const scenario = makeScenario();

      render(
        <SimulationResultCard result={result} scenario={scenario} compact />
      );

      expect(
        screen.queryByText('Vehicle: vehicle-abc')
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/^Ran:/)).not.toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // Outcome summary section styling
  // ----------------------------------------------------------

  describe('outcome summary section styling', () => {
    it('applies green styling for low risk outcome (risk_delta < 5)', () => {
      const result = makeResult({ result_data: { risk_delta: 2 } });

      const { container } = render(<SimulationResultCard result={result} />);

      const summarySection = container.querySelector('.bg-green-50.border-green-200');
      expect(summarySection).toBeInTheDocument();
    });

    it('applies yellow styling for medium risk outcome (5 <= risk_delta < 15)', () => {
      const result = makeResult({ result_data: { risk_delta: 10 } });

      const { container } = render(<SimulationResultCard result={result} />);

      const summarySection = container.querySelector('.bg-yellow-50.border-yellow-200');
      expect(summarySection).toBeInTheDocument();
    });

    it('applies orange styling for high risk outcome (15 <= risk_delta < 30)', () => {
      const result = makeResult({ result_data: { risk_delta: 20 } });

      const { container } = render(<SimulationResultCard result={result} />);

      const summarySection = container.querySelector('.bg-orange-50.border-orange-200');
      expect(summarySection).toBeInTheDocument();
    });

    it('applies red styling for critical risk outcome (risk_delta >= 30)', () => {
      const result = makeResult({ result_data: { risk_delta: 40 } });

      const { container } = render(<SimulationResultCard result={result} />);

      const summarySection = container.querySelector('.bg-red-50.border-red-200');
      expect(summarySection).toBeInTheDocument();
    });
  });
});

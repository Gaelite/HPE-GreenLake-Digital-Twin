import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import type { VehicleStatus, VehicleEquipment, EquipmentStatus } from '@/types';
import StatusIndicator from '../StatusIndicator';
import EquipmentChecklist from '../EquipmentChecklist';
import ReadinessScore from '../ReadinessScore';
import MetricGauge from '../MetricGauge';
import RiskScoreBadge from '@/components/anomaly/RiskScoreBadge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function makeEquipmentItem(
  overrides: Partial<VehicleEquipment> & { equipment_name: string; status: EquipmentStatus },
): VehicleEquipment {
  idCounter += 1;
  return {
    id: overrides.id ?? `equip-${idCounter}`,
    vehicle_id: overrides.vehicle_id ?? 'vehicle-1',
    equipment_name: overrides.equipment_name,
    category: overrides.category ?? 'General',
    status: overrides.status,
    last_checked: overrides.last_checked ?? '2025-06-01T12:00:00Z',
  };
}

/**
 * Helper: find an element whose className contains a given Tailwind class.
 * querySelector('span.bg-green-500') fails when the class contains special
 * CSS-selector characters (e.g. dots in 'h-2.5'). This helper works reliably.
 */
function queryByClass(container: HTMLElement, tag: string, className: string): HTMLElement | null {
  const els = container.querySelectorAll(tag);
  return (Array.from(els).find((el) => el.className.includes(className)) as HTMLElement) ?? null;
}

// ===========================================================================
// 1. StatusIndicator
// ===========================================================================

describe('StatusIndicator', () => {
  const allStatuses: VehicleStatus[] = [
    'available',
    'in_service',
    'en_route',
    'at_scene',
    'maintenance',
    'offline',
  ];

  const expectedLabels: Record<VehicleStatus, string> = {
    available: 'Available',
    in_service: 'In Service',
    en_route: 'En Route',
    at_scene: 'At Scene',
    maintenance: 'Maintenance',
    offline: 'Offline',
  };

  const expectedDotColors: Record<VehicleStatus, string> = {
    available: 'bg-green-500',
    in_service: 'bg-blue-500',
    en_route: 'bg-yellow-500',
    at_scene: 'bg-orange-500',
    maintenance: 'bg-gray-500',
    offline: 'bg-red-500',
  };

  it.each(allStatuses)('renders label for status "%s"', (status) => {
    render(<StatusIndicator status={status} />);
    expect(screen.getByText(expectedLabels[status])).toBeInTheDocument();
  });

  it.each(allStatuses)('renders correct dot color for status "%s"', (status) => {
    const { container } = render(<StatusIndicator status={status} />);
    const expectedClass = expectedDotColors[status];
    // The inner dot is a <span> with class "relative inline-flex rounded-full bg-<color>"
    const dot = queryByClass(container, 'span', expectedClass);
    expect(dot).not.toBeNull();
  });

  it('hides the label when showLabel is false', () => {
    render(<StatusIndicator status="available" showLabel={false} />);
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  });

  it('renders a pulse animation for active statuses (in_service, en_route, at_scene)', () => {
    const { container } = render(<StatusIndicator status="in_service" />);
    const pingSpan = queryByClass(container, 'span', 'animate-ping');
    expect(pingSpan).not.toBeNull();
  });

  it('does not render a pulse animation for non-active statuses by default', () => {
    const { container } = render(<StatusIndicator status="available" />);
    const pingSpan = queryByClass(container, 'span', 'animate-ping');
    expect(pingSpan).toBeNull();
  });

  it('renders a pulse animation when pulse prop is true even for non-active statuses', () => {
    const { container } = render(<StatusIndicator status="available" pulse />);
    const pingSpan = queryByClass(container, 'span', 'animate-ping');
    expect(pingSpan).not.toBeNull();
  });

  it('applies small size classes when size="sm"', () => {
    render(<StatusIndicator status="available" size="sm" />);
    expect(screen.getByText('Available')).toHaveClass('text-xs');
  });

  it('applies medium size classes by default', () => {
    render(<StatusIndicator status="available" />);
    expect(screen.getByText('Available')).toHaveClass('text-sm');
  });

  it('applies large size classes when size="lg"', () => {
    render(<StatusIndicator status="available" size="lg" />);
    expect(screen.getByText('Available')).toHaveClass('text-base');
  });

  it('applies the correct text color class per status', () => {
    const expectedTextColors: Record<VehicleStatus, string> = {
      available: 'text-green-700',
      in_service: 'text-blue-700',
      en_route: 'text-yellow-700',
      at_scene: 'text-orange-700',
      maintenance: 'text-gray-600',
      offline: 'text-red-700',
    };

    for (const status of allStatuses) {
      const { unmount } = render(<StatusIndicator status={status} />);
      expect(screen.getByText(expectedLabels[status])).toHaveClass(expectedTextColors[status]);
      unmount();
    }
  });
});

// ===========================================================================
// 2. EquipmentChecklist
// ===========================================================================

describe('EquipmentChecklist', () => {
  const sampleEquipment: VehicleEquipment[] = [
    makeEquipmentItem({ equipment_name: 'First Aid Kit', status: 'operational', category: 'Medical' }),
    makeEquipmentItem({ equipment_name: 'Fire Extinguisher', status: 'needs_repair', category: 'Safety' }),
    makeEquipmentItem({ equipment_name: 'Defibrillator', status: 'missing', category: 'Medical' }),
    makeEquipmentItem({ equipment_name: 'Spare Tire', status: 'replaced', category: 'Vehicle' }),
  ];

  it('renders all equipment item names', () => {
    render(<EquipmentChecklist equipment={sampleEquipment} />);
    expect(screen.getByText('First Aid Kit')).toBeInTheDocument();
    expect(screen.getByText('Fire Extinguisher')).toBeInTheDocument();
    expect(screen.getByText('Defibrillator')).toBeInTheDocument();
    expect(screen.getByText('Spare Tire')).toBeInTheDocument();
  });

  it('shows the correct icon for operational equipment (\u2713)', () => {
    render(<EquipmentChecklist equipment={sampleEquipment} />);
    expect(screen.getByText('\u2713')).toBeInTheDocument();
  });

  it('shows the correct icon for needs_repair equipment (\u26A0)', () => {
    render(<EquipmentChecklist equipment={sampleEquipment} />);
    expect(screen.getByText('\u26A0')).toBeInTheDocument();
  });

  it('shows the correct icon for missing equipment (\u2717)', () => {
    render(<EquipmentChecklist equipment={sampleEquipment} />);
    expect(screen.getByText('\u2717')).toBeInTheDocument();
  });

  it('shows the correct icon for replaced equipment (\u21BB)', () => {
    render(<EquipmentChecklist equipment={sampleEquipment} />);
    expect(screen.getByText('\u21BB')).toBeInTheDocument();
  });

  it('shows the correct status labels for each equipment status', () => {
    render(<EquipmentChecklist equipment={sampleEquipment} />);
    expect(screen.getByText('Operational')).toBeInTheDocument();
    expect(screen.getByText('Needs Repair')).toBeInTheDocument();
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.getByText('Replaced')).toBeInTheDocument();
  });

  it('displays the operational count summary', () => {
    render(<EquipmentChecklist equipment={sampleEquipment} />);
    // The component renders: <span className="font-semibold text-emerald-600">{totalOperational}</span>/{totalItems} operational
    // Only 1 out of 4 is operational
    expect(screen.getByText(/\/4 operational/)).toBeInTheDocument();
  });

  it('groups equipment by category with category headings', () => {
    render(<EquipmentChecklist equipment={sampleEquipment} />);
    expect(screen.getByText('Medical')).toBeInTheDocument();
    expect(screen.getByText('Safety')).toBeInTheDocument();
    expect(screen.getByText('Vehicle')).toBeInTheDocument();
  });

  it('renders the correct number of list items', () => {
    const { container } = render(<EquipmentChecklist equipment={sampleEquipment} />);
    expect(container.querySelectorAll('li')).toHaveLength(4);
  });

  it('renders empty state message when equipment list is empty', () => {
    render(<EquipmentChecklist equipment={[]} />);
    expect(screen.getByText('No equipment records available')).toBeInTheDocument();
  });

  it('does not render any list items when equipment list is empty', () => {
    const { container } = render(<EquipmentChecklist equipment={[]} />);
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('does not render summary bar when equipment list is empty', () => {
    render(<EquipmentChecklist equipment={[]} />);
    expect(screen.queryByText('Equipment Status')).not.toBeInTheDocument();
  });

  it('renders the last_checked date when provided', () => {
    const equipment = [
      makeEquipmentItem({
        equipment_name: 'Stretcher',
        status: 'operational',
        last_checked: '2025-06-01T12:00:00Z',
      }),
    ];
    render(<EquipmentChecklist equipment={equipment} />);
    const dateStr = new Date('2025-06-01T12:00:00Z').toLocaleDateString();
    expect(screen.getByText(dateStr)).toBeInTheDocument();
  });

  it('renders progress bar with correct width for operational ratio', () => {
    const { container } = render(<EquipmentChecklist equipment={sampleEquipment} />);
    // 1 out of 4 operational = 25%
    const progressBar = queryByClass(container, 'div', 'bg-emerald-500');
    expect(progressBar).not.toBeNull();
    expect(progressBar!.style.width).toBe('25%');
  });

  it('uses "Uncategorized" for items without a category', () => {
    const equipment = [
      makeEquipmentItem({
        equipment_name: 'Mystery Item',
        status: 'operational',
        category: '',
      }),
    ];
    render(<EquipmentChecklist equipment={equipment} />);
    expect(screen.getByText('Uncategorized')).toBeInTheDocument();
  });
});

// ===========================================================================
// 3. ReadinessScore
// ===========================================================================

describe('ReadinessScore', () => {
  it('renders the direct score value', () => {
    render(<ReadinessScore score={85} />);
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('renders the % symbol', () => {
    render(<ReadinessScore score={50} />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('clamps score to 0 when negative', () => {
    render(<ReadinessScore score={-10} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('clamps score to 100 when above 100', () => {
    render(<ReadinessScore score={150} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('applies green color and "Good" label for score > 70', () => {
    render(<ReadinessScore score={85} />);
    const scoreEl = screen.getByText('85');
    expect(scoreEl.className).toContain('text-emerald-600');
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('applies amber color and "Fair" label for score between 41 and 70', () => {
    render(<ReadinessScore score={55} />);
    const scoreEl = screen.getByText('55');
    expect(scoreEl.className).toContain('text-amber-600');
    expect(screen.getByText('Fair')).toBeInTheDocument();
  });

  it('applies red color and "Critical" label for score <= 40', () => {
    render(<ReadinessScore score={30} />);
    const scoreEl = screen.getByText('30');
    expect(scoreEl.className).toContain('text-red-600');
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('renders "Operational Readiness" subtitle for non-sm sizes', () => {
    render(<ReadinessScore score={75} size="lg" />);
    expect(screen.getByText('Operational Readiness')).toBeInTheDocument();
  });

  it('also renders label/subtitle for md size', () => {
    render(<ReadinessScore score={75} size="md" />);
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Operational Readiness')).toBeInTheDocument();
  });

  it('hides label and subtitle for sm size', () => {
    render(<ReadinessScore score={75} size="sm" />);
    expect(screen.queryByText('Good')).not.toBeInTheDocument();
    expect(screen.queryByText('Operational Readiness')).not.toBeInTheDocument();
  });

  it('renders an SVG element for the circular gauge', () => {
    const { container } = render(<ReadinessScore score={50} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders two circle elements (background and value)', () => {
    const { container } = render(<ReadinessScore score={50} />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(2);
  });

  it('sets the value circle stroke to the correct color', () => {
    const { container } = render(<ReadinessScore score={85} />);
    const circles = container.querySelectorAll('circle');
    // The second circle is the value circle; green for > 70
    expect(circles[1].getAttribute('stroke')).toBe('#10b981');
  });

  it('sets the value circle stroke to amber for fair scores', () => {
    const { container } = render(<ReadinessScore score={55} />);
    const circles = container.querySelectorAll('circle');
    expect(circles[1].getAttribute('stroke')).toBe('#f59e0b');
  });

  it('sets the value circle stroke to red for critical scores', () => {
    const { container } = render(<ReadinessScore score={20} />);
    const circles = container.querySelectorAll('circle');
    expect(circles[1].getAttribute('stroke')).toBe('#ef4444');
  });

  describe('computed score (no direct score prop)', () => {
    it('computes 100 when all factors are optimal', () => {
      const equipment: VehicleEquipment[] = [
        makeEquipmentItem({ equipment_name: 'Kit', status: 'operational' }),
      ];
      render(
        <ReadinessScore
          fuelLevel={80}
          equipment={equipment}
          hasCriticalAnomalies={false}
          engineTemp={80}
        />,
      );
      // 25 (fuel>20) + 35 (all operational) + 20 (no anomalies) + 20 (temp<100) = 100
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('penalizes for critical anomalies (score drops to 80)', () => {
      const equipment: VehicleEquipment[] = [
        makeEquipmentItem({ equipment_name: 'Kit', status: 'operational' }),
      ];
      render(
        <ReadinessScore
          fuelLevel={80}
          equipment={equipment}
          hasCriticalAnomalies={true}
          engineTemp={80}
        />,
      );
      // 25 + 35 + 0 + 20 = 80/100
      expect(screen.getByText('80')).toBeInTheDocument();
    });

    it('penalizes for very low fuel level (score drops to 75)', () => {
      render(
        <ReadinessScore
          fuelLevel={5}
          equipment={[]}
          hasCriticalAnomalies={false}
          engineTemp={80}
        />,
      );
      // 0 (fuel<=10) + 35 (no equip=assume OK) + 20 + 20 = 75/100
      expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('gives half fuel points for marginal fuel (10-20%)', () => {
      render(
        <ReadinessScore
          fuelLevel={15}
          equipment={[]}
          hasCriticalAnomalies={false}
          engineTemp={80}
        />,
      );
      // 12 (fuel 10<x<=20) + 35 + 20 + 20 = 87/100
      expect(screen.getByText('87')).toBeInTheDocument();
    });

    it('penalizes for high engine temperature (score drops to 90)', () => {
      render(
        <ReadinessScore
          fuelLevel={80}
          equipment={[]}
          hasCriticalAnomalies={false}
          engineTemp={105}
        />,
      );
      // 25 + 35 + 20 + 10 (100<=temp<110 = half) = 90/100
      expect(screen.getByText('90')).toBeInTheDocument();
    });

    it('gives zero engine points for extreme temperature (>=110)', () => {
      render(
        <ReadinessScore
          fuelLevel={80}
          equipment={[]}
          hasCriticalAnomalies={false}
          engineTemp={120}
        />,
      );
      // 25 + 35 + 20 + 0 = 80/100
      expect(screen.getByText('80')).toBeInTheDocument();
    });

    it('scales equipment score proportionally to operational count', () => {
      const equipment: VehicleEquipment[] = [
        makeEquipmentItem({ equipment_name: 'A', status: 'operational' }),
        makeEquipmentItem({ equipment_name: 'B', status: 'missing' }),
      ];
      render(
        <ReadinessScore
          fuelLevel={80}
          equipment={equipment}
          hasCriticalAnomalies={false}
          engineTemp={80}
        />,
      );
      // 25 + round(1/2 * 35 = 17.5 -> 18) + 20 + 20 = 83/100
      expect(screen.getByText('83')).toBeInTheDocument();
    });
  });

  describe('boundary conditions', () => {
    it('score of exactly 70 displays amber/Fair (> 40 but not > 70)', () => {
      render(<ReadinessScore score={70} />);
      expect(screen.getByText('Fair')).toBeInTheDocument();
      const scoreEl = screen.getByText('70');
      expect(scoreEl.className).toContain('text-amber-600');
    });

    it('score of exactly 71 displays green/Good', () => {
      render(<ReadinessScore score={71} />);
      expect(screen.getByText('Good')).toBeInTheDocument();
      const scoreEl = screen.getByText('71');
      expect(scoreEl.className).toContain('text-emerald-600');
    });

    it('score of exactly 40 displays amber/Fair (> 40 is false, but 40 > 40 is false so this is red)', () => {
      // Checking: computedScore > 70 => false; computedScore > 40 => false; so it's red/Critical
      render(<ReadinessScore score={40} />);
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('score of exactly 41 displays amber/Fair', () => {
      render(<ReadinessScore score={41} />);
      expect(screen.getByText('Fair')).toBeInTheDocument();
    });

    it('score of exactly 0 displays red/Critical', () => {
      render(<ReadinessScore score={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('score of exactly 100 displays green/Good', () => {
      render(<ReadinessScore score={100} />);
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 4. MetricGauge
// ===========================================================================

describe('MetricGauge', () => {
  const defaultProps = {
    label: 'Engine Temp',
    value: 85,
    unit: '\u00B0C',
    min: 0,
    max: 150,
    warningThreshold: 100,
    criticalThreshold: 120,
  };

  it('renders the label text', () => {
    render(<MetricGauge {...defaultProps} />);
    expect(screen.getByText('Engine Temp')).toBeInTheDocument();
  });

  it('renders the unit text in full gauge SVG', () => {
    const { container } = render(<MetricGauge {...defaultProps} />);
    // The unit is rendered inside an SVG <text> element
    const textEls = container.querySelectorAll('text');
    const unitEl = Array.from(textEls).find((el) => el.textContent === '\u00B0C');
    expect(unitEl).toBeTruthy();
  });

  it('renders the formatted integer value in SVG', () => {
    const { container } = render(<MetricGauge {...defaultProps} />);
    const textEls = container.querySelectorAll('text');
    const valueEl = Array.from(textEls).find((el) => el.textContent === '85');
    expect(valueEl).toBeTruthy();
  });

  it('formats decimal values to one decimal place', () => {
    const { container } = render(<MetricGauge {...defaultProps} value={85.7} />);
    const textEls = container.querySelectorAll('text');
    const valueEl = Array.from(textEls).find((el) => el.textContent === '85.7');
    expect(valueEl).toBeTruthy();
  });

  it('renders min and max labels in full gauge mode', () => {
    const { container } = render(<MetricGauge {...defaultProps} />);
    const spans = container.querySelectorAll('span');
    const minEl = Array.from(spans).find((el) => el.textContent === '0');
    const maxEl = Array.from(spans).find((el) => el.textContent === '150');
    expect(minEl).toBeTruthy();
    expect(maxEl).toBeTruthy();
  });

  it('renders an SVG in non-compact mode', () => {
    const { container } = render(<MetricGauge {...defaultProps} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  describe('normal thresholds (higher is worse)', () => {
    it('shows emerald/normal ring when value is below warning threshold', () => {
      const { container } = render(<MetricGauge {...defaultProps} value={85} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('ring-emerald-200');
    });

    it('shows amber/warning ring when value reaches warning threshold', () => {
      const { container } = render(<MetricGauge {...defaultProps} value={105} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('ring-amber-200');
    });

    it('shows red/critical ring when value reaches critical threshold', () => {
      const { container } = render(<MetricGauge {...defaultProps} value={125} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('ring-red-200');
    });

    it('shows warning exactly at the warning threshold value', () => {
      const { container } = render(<MetricGauge {...defaultProps} value={100} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('ring-amber-200');
    });

    it('shows critical exactly at the critical threshold value', () => {
      const { container } = render(<MetricGauge {...defaultProps} value={120} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('ring-red-200');
    });
  });

  describe('inverted thresholds (lower is worse)', () => {
    const fuelProps = {
      label: 'Fuel Level',
      value: 80,
      unit: '%',
      min: 0,
      max: 100,
      warningThreshold: 25,
      criticalThreshold: 10,
      invertThresholds: true,
    };

    it('shows emerald/normal when value is above warning threshold', () => {
      const { container } = render(<MetricGauge {...fuelProps} value={80} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('ring-emerald-200');
    });

    it('shows amber/warning when value is at or below warning threshold', () => {
      const { container } = render(<MetricGauge {...fuelProps} value={20} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('ring-amber-200');
    });

    it('shows red/critical when value is at or below critical threshold', () => {
      const { container } = render(<MetricGauge {...fuelProps} value={8} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('ring-red-200');
    });

    it('shows warning exactly at the warning threshold value', () => {
      const { container } = render(<MetricGauge {...fuelProps} value={25} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('ring-amber-200');
    });

    it('shows critical exactly at the critical threshold value', () => {
      const { container } = render(<MetricGauge {...fuelProps} value={10} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('ring-red-200');
    });
  });

  describe('compact mode', () => {
    it('does not render SVG arc in compact mode', () => {
      const { container } = render(<MetricGauge {...defaultProps} compact />);
      expect(container.querySelector('svg')).toBeNull();
    });

    it('renders the label in compact mode', () => {
      render(<MetricGauge {...defaultProps} compact />);
      expect(screen.getByText('Engine Temp')).toBeInTheDocument();
    });

    it('renders the unit in compact mode', () => {
      render(<MetricGauge {...defaultProps} compact />);
      expect(screen.getByText('\u00B0C')).toBeInTheDocument();
    });

    it('renders a progress bar div with correct percentage width', () => {
      const { container } = render(<MetricGauge {...defaultProps} value={85} compact />);
      // percentage = ((85 - 0) / (150 - 0)) * 100 = 56.666...%
      const bar = queryByClass(container, 'div', 'bg-emerald-500');
      expect(bar).not.toBeNull();
      const widthValue = parseFloat(bar!.style.width);
      expect(widthValue).toBeCloseTo(56.67, 0);
    });

    it('applies emerald bar color in compact mode for normal range', () => {
      const { container } = render(<MetricGauge {...defaultProps} value={85} compact />);
      expect(queryByClass(container, 'div', 'bg-emerald-500')).not.toBeNull();
    });

    it('applies amber bar color in compact mode for warning range', () => {
      const { container } = render(<MetricGauge {...defaultProps} value={105} compact />);
      expect(queryByClass(container, 'div', 'bg-amber-500')).not.toBeNull();
    });

    it('applies red bar color in compact mode for critical range', () => {
      const { container } = render(<MetricGauge {...defaultProps} value={125} compact />);
      expect(queryByClass(container, 'div', 'bg-red-500')).not.toBeNull();
    });

    it('renders the formatted value text in compact mode', () => {
      render(<MetricGauge {...defaultProps} value={85} compact />);
      expect(screen.getByText(/85/)).toBeInTheDocument();
    });
  });

  describe('value clamping', () => {
    it('clamps bar width to 100% for values exceeding max', () => {
      const { container } = render(<MetricGauge {...defaultProps} value={200} compact />);
      const bar = queryByClass(container, 'div', 'bg-red-500');
      expect(bar).not.toBeNull();
      expect(bar!.style.width).toBe('100%');
    });

    it('clamps bar width to 0% for values below min', () => {
      const { container } = render(<MetricGauge {...defaultProps} value={-50} compact />);
      const bar = queryByClass(container, 'div', 'bg-emerald-500');
      expect(bar).not.toBeNull();
      expect(bar!.style.width).toBe('0%');
    });
  });
});

// ===========================================================================
// 5. RiskScoreBadge
// ===========================================================================

describe('RiskScoreBadge', () => {
  it('renders the numeric score', () => {
    render(<RiskScoreBadge score={45} />);
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('clamps score to 0 for negative values', () => {
    render(<RiskScoreBadge score={-5} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('clamps score to 100 for values over 100', () => {
    render(<RiskScoreBadge score={120} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders a title attribute with score and label', () => {
    render(<RiskScoreBadge score={45} />);
    const badge = screen.getByTitle('Risk Score: 45/100 (Moderate)');
    expect(badge).toBeInTheDocument();
  });

  describe('color thresholds: green 0-30, yellow 31-60, orange 61-80, red 81-100', () => {
    it('applies green/Low styling for score 0', () => {
      render(<RiskScoreBadge score={0} />);
      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByTitle('Risk Score: 0/100 (Low)').className).toContain('bg-green-100');
    });

    it('applies green/Low styling for score 30 (boundary)', () => {
      render(<RiskScoreBadge score={30} />);
      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByTitle('Risk Score: 30/100 (Low)').className).toContain('bg-green-100');
    });

    it('applies yellow/Moderate styling for score 31 (boundary)', () => {
      render(<RiskScoreBadge score={31} />);
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByTitle('Risk Score: 31/100 (Moderate)').className).toContain('bg-yellow-100');
    });

    it('applies yellow/Moderate styling for score 60 (boundary)', () => {
      render(<RiskScoreBadge score={60} />);
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByTitle('Risk Score: 60/100 (Moderate)').className).toContain('bg-yellow-100');
    });

    it('applies orange/High styling for score 61 (boundary)', () => {
      render(<RiskScoreBadge score={61} />);
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByTitle('Risk Score: 61/100 (High)').className).toContain('bg-orange-100');
    });

    it('applies orange/High styling for score 80 (boundary)', () => {
      render(<RiskScoreBadge score={80} />);
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByTitle('Risk Score: 80/100 (High)').className).toContain('bg-orange-100');
    });

    it('applies red/Critical styling for score 81 (boundary)', () => {
      render(<RiskScoreBadge score={81} />);
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByTitle('Risk Score: 81/100 (Critical)').className).toContain('bg-red-100');
    });

    it('applies red/Critical styling for score 100', () => {
      render(<RiskScoreBadge score={100} />);
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByTitle('Risk Score: 100/100 (Critical)').className).toContain('bg-red-100');
    });
  });

  describe('colored dot indicator', () => {
    it('renders a green dot for low risk', () => {
      const { container } = render(<RiskScoreBadge score={15} />);
      expect(queryByClass(container, 'span', 'bg-green-500')).not.toBeNull();
    });

    it('renders a yellow dot for moderate risk', () => {
      const { container } = render(<RiskScoreBadge score={50} />);
      expect(queryByClass(container, 'span', 'bg-yellow-500')).not.toBeNull();
    });

    it('renders an orange dot for high risk', () => {
      const { container } = render(<RiskScoreBadge score={75} />);
      expect(queryByClass(container, 'span', 'bg-orange-500')).not.toBeNull();
    });

    it('renders a red dot for critical risk', () => {
      const { container } = render(<RiskScoreBadge score={95} />);
      expect(queryByClass(container, 'span', 'bg-red-500')).not.toBeNull();
    });
  });

  describe('showLabel prop', () => {
    it('shows the risk label by default', () => {
      render(<RiskScoreBadge score={20} />);
      expect(screen.getByText('Low')).toBeInTheDocument();
    });

    it('hides the risk label when showLabel is false', () => {
      render(<RiskScoreBadge score={20} showLabel={false} />);
      expect(screen.queryByText('Low')).not.toBeInTheDocument();
    });

    it('still renders the numeric score when showLabel is false', () => {
      render(<RiskScoreBadge score={20} showLabel={false} />);
      expect(screen.getByText('20')).toBeInTheDocument();
    });
  });

  describe('size prop', () => {
    it('applies sm size class (text-xs)', () => {
      const { container } = render(<RiskScoreBadge score={50} size="sm" />);
      const badge = screen.getByTitle('Risk Score: 50/100 (Moderate)');
      expect(badge.className).toContain('text-xs');
    });

    it('applies md size class (text-sm) by default', () => {
      const badge = render(<RiskScoreBadge score={50} />);
      const el = screen.getByTitle('Risk Score: 50/100 (Moderate)');
      expect(el.className).toContain('text-sm');
    });

    it('applies lg size class (text-base)', () => {
      render(<RiskScoreBadge score={50} size="lg" />);
      const badge = screen.getByTitle('Risk Score: 50/100 (Moderate)');
      expect(badge.className).toContain('text-base');
    });
  });
});

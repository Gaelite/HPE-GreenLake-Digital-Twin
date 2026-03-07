import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Vehicle, VehicleStatus, VehicleType } from '@/types';
import StatusBadge from '../StatusBadge';
import VehicleTypeIcon from '../VehicleTypeIcon';
import VehicleCard from '../VehicleCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------
function buildVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v-001',
    type: 'police',
    name: 'Unit Alpha-7',
    plate_number: 'POL-1234',
    status: 'available',
    year: 2023,
    make: 'Ford',
    model: 'Explorer',
    specifications: {},
    current_latitude: 40.4168,
    current_longitude: -3.7038,
    risk_score: 25,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-06-20T14:30:00Z',
    ...overrides,
  };
}

const mockAmbulance: Vehicle = buildVehicle({
  id: 'v-002',
  type: 'ambulance',
  name: 'Medic-12',
  plate_number: 'AMB-5678',
  status: 'en_route',
  year: 2022,
  make: 'Mercedes-Benz',
  model: 'Sprinter',
  risk_score: 55,
});

const mockFireTruck: Vehicle = buildVehicle({
  id: 'v-003',
  type: 'fire_truck',
  name: 'Ladder-3',
  plate_number: 'FT-9012',
  status: 'at_scene',
  year: 2021,
  make: 'Pierce',
  model: 'Arrow XT',
  risk_score: 80,
});

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------
describe('StatusBadge', () => {
  const statusLabels: Record<VehicleStatus, string> = {
    available: 'Available',
    in_service: 'In Service',
    en_route: 'En Route',
    at_scene: 'At Scene',
    maintenance: 'Maintenance',
    offline: 'Offline',
  };

  const statusColors: Record<VehicleStatus, string> = {
    available: 'bg-green-500',
    in_service: 'bg-blue-500',
    en_route: 'bg-yellow-500',
    at_scene: 'bg-orange-500',
    maintenance: 'bg-gray-500',
    offline: 'bg-red-500',
  };

  const allStatuses: VehicleStatus[] = [
    'available',
    'in_service',
    'en_route',
    'at_scene',
    'maintenance',
    'offline',
  ];

  it.each(allStatuses)('renders the label text for status "%s"', (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(statusLabels[status])).toBeInTheDocument();
  });

  it.each(allStatuses)(
    'applies the correct color class for status "%s"',
    (status) => {
      const { container } = render(<StatusBadge status={status} />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass(statusColors[status]);
    },
  );

  it('defaults to the "md" size class when no size prop is given', () => {
    const { container } = render(<StatusBadge status="available" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('px-2.5');
    expect(badge).toHaveClass('py-1');
  });

  it('applies "sm" size classes when size="sm"', () => {
    const { container } = render(<StatusBadge status="available" size="sm" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('px-2');
    expect(badge).toHaveClass('py-0.5');
  });

  it('applies "lg" size classes when size="lg"', () => {
    const { container } = render(<StatusBadge status="available" size="lg" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('px-3');
    expect(badge).toHaveClass('py-1.5');
    expect(badge).toHaveClass('text-sm');
  });

  it('renders the indicator dot element', () => {
    const { container } = render(<StatusBadge status="in_service" />);
    const dot = container.querySelector('span > span.rounded-full');
    expect(dot).toBeInTheDocument();
  });

  it('always applies the text-white class', () => {
    const { container } = render(<StatusBadge status="offline" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('text-white');
  });
});

// ---------------------------------------------------------------------------
// VehicleTypeIcon
// ---------------------------------------------------------------------------
describe('VehicleTypeIcon', () => {
  const typeIcons: Record<VehicleType, string> = {
    police: '\uD83D\uDE94',
    ambulance: '\uD83D\uDE91',
    fire_truck: '\uD83D\uDE92',
    civil_protection: '\uD83D\uDEE1\uFE0F',
    hybrid: '\u2699\uFE0F',
  };

  const typeLabels: Record<VehicleType, string> = {
    police: 'Police',
    ambulance: 'Ambulance',
    fire_truck: 'Fire Truck',
    civil_protection: 'Civil Protection',
    hybrid: 'Hybrid',
  };

  const allTypes: VehicleType[] = [
    'police',
    'ambulance',
    'fire_truck',
    'civil_protection',
    'hybrid',
  ];

  it.each(allTypes)(
    'renders the correct emoji icon for vehicle type "%s"',
    (type) => {
      render(<VehicleTypeIcon type={type} />);
      const icon = screen.getByRole('img', { name: typeLabels[type] });
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveTextContent(typeIcons[type]);
    },
  );

  it.each(allTypes)(
    'sets the correct aria-label for vehicle type "%s"',
    (type) => {
      render(<VehicleTypeIcon type={type} />);
      const icon = screen.getByRole('img', { name: typeLabels[type] });
      expect(icon).toHaveAttribute('aria-label', typeLabels[type]);
    },
  );

  it('does not render a text label by default', () => {
    render(<VehicleTypeIcon type="police" />);
    expect(screen.queryByText('Police')).not.toBeInTheDocument();
  });

  it('renders a text label when showLabel is true', () => {
    render(<VehicleTypeIcon type="ambulance" showLabel />);
    expect(screen.getByText('Ambulance')).toBeInTheDocument();
  });

  it.each(allTypes)(
    'renders the text label for type "%s" when showLabel is true',
    (type) => {
      render(<VehicleTypeIcon type={type} showLabel />);
      expect(screen.getByText(typeLabels[type])).toBeInTheDocument();
    },
  );

  it('defaults to the "md" size class (text-xl)', () => {
    const { container } = render(<VehicleTypeIcon type="fire_truck" />);
    const wrapper = container.querySelector('span');
    expect(wrapper).toHaveClass('text-xl');
  });

  it('applies "sm" size class (text-base) when size="sm"', () => {
    const { container } = render(
      <VehicleTypeIcon type="fire_truck" size="sm" />,
    );
    const wrapper = container.querySelector('span');
    expect(wrapper).toHaveClass('text-base');
  });

  it('applies "lg" size class (text-3xl) when size="lg"', () => {
    const { container } = render(
      <VehicleTypeIcon type="fire_truck" size="lg" />,
    );
    const wrapper = container.querySelector('span');
    expect(wrapper).toHaveClass('text-3xl');
  });
});

// ---------------------------------------------------------------------------
// VehicleCard
// ---------------------------------------------------------------------------
describe('VehicleCard', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders the vehicle name', () => {
    render(<VehicleCard vehicle={buildVehicle()} />);
    expect(screen.getByText('Unit Alpha-7')).toBeInTheDocument();
  });

  it('renders the plate number', () => {
    render(<VehicleCard vehicle={buildVehicle()} />);
    expect(screen.getByText('POL-1234')).toBeInTheDocument();
  });

  it('renders the StatusBadge with the correct status text', () => {
    render(<VehicleCard vehicle={buildVehicle({ status: 'in_service' })} />);
    expect(screen.getByText('In Service')).toBeInTheDocument();
  });

  it('renders the VehicleTypeIcon for the vehicle type', () => {
    render(<VehicleCard vehicle={buildVehicle({ type: 'ambulance' })} />);
    expect(screen.getByRole('img', { name: 'Ambulance' })).toBeInTheDocument();
  });

  it('displays the vehicle type label from VEHICLE_TYPE_LABELS', () => {
    render(<VehicleCard vehicle={buildVehicle({ type: 'fire_truck' })} />);
    expect(screen.getByText('Fire Truck')).toBeInTheDocument();
  });

  it('displays the year, make, and model', () => {
    const vehicle = buildVehicle({
      year: 2023,
      make: 'Ford',
      model: 'Explorer',
    });
    render(<VehicleCard vehicle={vehicle} />);
    expect(screen.getByText('2023 Ford Explorer')).toBeInTheDocument();
  });

  it('displays the risk score with /100 suffix', () => {
    render(<VehicleCard vehicle={buildVehicle({ risk_score: 25 })} />);
    expect(screen.getByText('25/100')).toBeInTheDocument();
  });

  it('navigates to the vehicle detail page when clicked', () => {
    const vehicle = buildVehicle({ id: 'v-001' });
    const { container } = render(<VehicleCard vehicle={vehicle} />);
    const card = container.firstChild as HTMLElement;

    fireEvent.click(card);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/fleet/v-001');
  });

  it('has a cursor-pointer class indicating it is clickable', () => {
    const { container } = render(<VehicleCard vehicle={buildVehicle()} />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('cursor-pointer');
  });

  describe('risk score color coding', () => {
    it('applies green color for low risk (score <= 30)', () => {
      render(<VehicleCard vehicle={buildVehicle({ risk_score: 20 })} />);
      const scoreText = screen.getByText('20/100');
      expect(scoreText).toHaveClass('text-green-600');
    });

    it('applies yellow color for medium risk (30 < score <= 60)', () => {
      render(<VehicleCard vehicle={mockAmbulance} />);
      const scoreText = screen.getByText('55/100');
      expect(scoreText).toHaveClass('text-yellow-600');
    });

    it('applies red color for high risk (score > 60)', () => {
      render(<VehicleCard vehicle={mockFireTruck} />);
      const scoreText = screen.getByText('80/100');
      expect(scoreText).toHaveClass('text-red-600');
    });
  });

  describe('renders correctly with different vehicle types', () => {
    it('renders an ambulance card with all expected content', () => {
      render(<VehicleCard vehicle={mockAmbulance} />);

      expect(screen.getByText('Medic-12')).toBeInTheDocument();
      expect(screen.getByText('AMB-5678')).toBeInTheDocument();
      expect(screen.getByText('En Route')).toBeInTheDocument();
      expect(screen.getByText('Ambulance')).toBeInTheDocument();
      expect(
        screen.getByText('2022 Mercedes-Benz Sprinter'),
      ).toBeInTheDocument();
    });

    it('renders a fire truck card with all expected content', () => {
      render(<VehicleCard vehicle={mockFireTruck} />);

      expect(screen.getByText('Ladder-3')).toBeInTheDocument();
      expect(screen.getByText('FT-9012')).toBeInTheDocument();
      expect(screen.getByText('At Scene')).toBeInTheDocument();
      expect(screen.getByText('Fire Truck')).toBeInTheDocument();
      expect(screen.getByText('2021 Pierce Arrow XT')).toBeInTheDocument();
    });
  });
});

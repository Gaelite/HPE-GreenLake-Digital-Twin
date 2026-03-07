import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
describe('Badge', () => {
  it('renders the label text', () => {
    render(<Badge label="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies default variant classes when no variant is specified', () => {
    render(<Badge label="Default" />);
    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-700', 'ring-gray-200');
  });

  it.each<{
    variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
    expected: string[];
  }>([
    { variant: 'default', expected: ['bg-gray-100', 'text-gray-700', 'ring-gray-200'] },
    { variant: 'success', expected: ['bg-emerald-50', 'text-emerald-700', 'ring-emerald-200'] },
    { variant: 'warning', expected: ['bg-amber-50', 'text-amber-700', 'ring-amber-200'] },
    { variant: 'danger', expected: ['bg-red-50', 'text-red-700', 'ring-red-200'] },
    { variant: 'info', expected: ['bg-blue-50', 'text-blue-700', 'ring-blue-200'] },
  ])('applies correct classes for variant="$variant"', ({ variant, expected }) => {
    render(<Badge label="Tag" variant={variant} />);
    const badge = screen.getByText('Tag');
    expected.forEach((cls) => {
      expect(badge).toHaveClass(cls);
    });
  });

  it('applies sm size classes', () => {
    render(<Badge label="Small" size="sm" />);
    const badge = screen.getByText('Small');
    expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
  });

  it('applies md size classes by default', () => {
    render(<Badge label="Medium" />);
    const badge = screen.getByText('Medium');
    expect(badge).toHaveClass('px-2.5', 'py-1', 'text-xs');
  });
});

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Press</Button>);
    fireEvent.click(screen.getByRole('button', { name: /press/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows the loading spinner when isLoading is true', () => {
    render(<Button isLoading>Saving</Button>);
    const button = screen.getByRole('button', { name: /saving/i });
    // The LoadingDots SVG has the animate-spin class
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('animate-spin');
  });

  it('does not show the loading spinner when isLoading is false', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: /save/i });
    const svg = button.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });

  it('is disabled when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button', { name: /disabled/i })).toBeDisabled();
  });

  it('does not call onClick when disabled', () => {
    const handleClick = jest.fn();
    render(
      <Button disabled onClick={handleClick}>
        No Click
      </Button>
    );
    fireEvent.click(screen.getByRole('button', { name: /no click/i }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders with primary variant classes by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button', { name: /primary/i });
    expect(button).toHaveClass('bg-blue-600', 'text-white');
  });

  it.each<{
    variant: 'primary' | 'secondary' | 'danger' | 'ghost';
    expected: string[];
  }>([
    { variant: 'primary', expected: ['bg-blue-600', 'text-white'] },
    { variant: 'secondary', expected: ['bg-white', 'text-gray-700'] },
    { variant: 'danger', expected: ['bg-red-600', 'text-white'] },
    { variant: 'ghost', expected: ['bg-transparent', 'text-gray-600'] },
  ])('renders correct classes for variant="$variant"', ({ variant, expected }) => {
    render(<Button variant={variant}>Btn</Button>);
    const button = screen.getByRole('button', { name: /btn/i });
    expected.forEach((cls) => {
      expect(button).toHaveClass(cls);
    });
  });

  it('renders with the correct button type attribute', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button', { name: /submit/i })).toHaveAttribute('type', 'submit');
  });

  it('defaults to type="button"', () => {
    render(<Button>Default Type</Button>);
    expect(screen.getByRole('button', { name: /default type/i })).toHaveAttribute(
      'type',
      'button'
    );
  });
});

// ---------------------------------------------------------------------------
// LoadingSpinner
// ---------------------------------------------------------------------------
describe('LoadingSpinner', () => {
  it('renders with role="status"', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('contains a screen-reader-only "Loading..." label', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('applies md size classes by default', () => {
    render(<LoadingSpinner />);
    const container = screen.getByRole('status');
    const spinner = container.firstElementChild as HTMLElement;
    expect(spinner).toHaveClass('h-8', 'w-8');
  });

  it.each<{ size: 'sm' | 'md' | 'lg'; expected: string[] }>([
    { size: 'sm', expected: ['h-4', 'w-4', 'border-2'] },
    { size: 'md', expected: ['h-8', 'w-8'] },
    { size: 'lg', expected: ['h-12', 'w-12', 'border-4'] },
  ])('renders with correct classes for size="$size"', ({ size, expected }) => {
    render(<LoadingSpinner size={size} />);
    const container = screen.getByRole('status');
    const spinner = container.firstElementChild as HTMLElement;
    expected.forEach((cls) => {
      expect(spinner).toHaveClass(cls);
    });
  });

  it('has the animate-spin class on the spinner element', () => {
    render(<LoadingSpinner />);
    const container = screen.getByRole('status');
    const spinner = container.firstElementChild as HTMLElement;
    expect(spinner).toHaveClass('animate-spin');
  });
});

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No results" description="Try a different search." />);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<EmptyState title="No results" description="Try a different search." />);
    expect(screen.getByText('Try a different search.')).toBeInTheDocument();
  });

  it('renders an action when provided', () => {
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        action={<button>Add Item</button>}
      />
    );
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });

  it('does not crash when action is not provided', () => {
    const { container } = render(
      <EmptyState title="Empty" description="Nothing here" />
    );
    // The component should render without errors and contain the title
    expect(container).toBeInTheDocument();
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('renders a custom icon when provided', () => {
    render(
      <EmptyState
        title="Custom Icon"
        description="Has icon"
        icon={<span data-testid="custom-icon">Icon</span>}
      />
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders the default icon when no icon prop is provided', () => {
    const { container } = render(
      <EmptyState title="Default Icon" description="Uses default" />
    );
    // The DefaultIcon is an SVG rendered inside the component
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------
describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="Dashboard" />);
    expect(
      screen.getByRole('heading', { level: 1, name: /dashboard/i })
    ).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(<PageHeader title="Dashboard" description="Overview of all metrics" />);
    expect(screen.getByText('Overview of all metrics')).toBeInTheDocument();
  });

  it('does not render a description element when description is omitted', () => {
    const { container } = render(<PageHeader title="Dashboard" />);
    // The description is wrapped in a <p> tag with text-sm class; it should not exist
    const paragraph = container.querySelector('p');
    expect(paragraph).not.toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <PageHeader
        title="Users"
        actions={<button>Create User</button>}
      />
    );
    expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
  });

  it('does not render the actions wrapper when actions are omitted', () => {
    const { container } = render(<PageHeader title="Users" />);
    // The actions are wrapped in a div with flex-shrink-0 class; verify it does not appear
    const actionWrapper = container.querySelector('.flex-shrink-0');
    expect(actionWrapper).not.toBeInTheDocument();
  });
});

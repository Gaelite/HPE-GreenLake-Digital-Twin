import {
  VEHICLE_TYPE_LABELS,
  STATUS_COLORS,
  SEVERITY_COLORS,
} from '@/types';
import type { VehicleType, VehicleStatus, Severity } from '@/types';

describe('types/index — UI Helper Constants', () => {
  // ---------------------------------------------------------------------------
  // VEHICLE_TYPE_LABELS
  // ---------------------------------------------------------------------------
  describe('VEHICLE_TYPE_LABELS', () => {
    const expectedLabels: Record<VehicleType, string> = {
      police: 'Police',
      ambulance: 'Ambulance',
      fire_truck: 'Fire Truck',
      civil_protection: 'Civil Protection',
      hybrid: 'Hybrid/Specialized',
    };

    it('contains exactly 5 entries', () => {
      expect(Object.keys(VEHICLE_TYPE_LABELS)).toHaveLength(5);
    });

    it('has all expected vehicle type keys', () => {
      const expectedKeys: VehicleType[] = [
        'police',
        'ambulance',
        'fire_truck',
        'civil_protection',
        'hybrid',
      ];
      expect(Object.keys(VEHICLE_TYPE_LABELS).sort()).toEqual([...expectedKeys].sort());
    });

    it('has no unexpected keys', () => {
      const allowedKeys = new Set<string>([
        'police',
        'ambulance',
        'fire_truck',
        'civil_protection',
        'hybrid',
      ]);
      Object.keys(VEHICLE_TYPE_LABELS).forEach((key) => {
        expect(allowedKeys.has(key)).toBe(true);
      });
    });

    it.each(Object.entries(expectedLabels))(
      'maps "%s" to "%s"',
      (type, label) => {
        expect(VEHICLE_TYPE_LABELS[type as VehicleType]).toBe(label);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // STATUS_COLORS
  // ---------------------------------------------------------------------------
  describe('STATUS_COLORS', () => {
    const expectedColors: Record<VehicleStatus, string> = {
      available: 'bg-green-500',
      in_service: 'bg-blue-500',
      en_route: 'bg-yellow-500',
      at_scene: 'bg-orange-500',
      maintenance: 'bg-gray-500',
      offline: 'bg-red-500',
    };

    it('contains exactly 6 entries', () => {
      expect(Object.keys(STATUS_COLORS)).toHaveLength(6);
    });

    it('has all expected status keys', () => {
      const expectedKeys: VehicleStatus[] = [
        'available',
        'in_service',
        'en_route',
        'at_scene',
        'maintenance',
        'offline',
      ];
      expect(Object.keys(STATUS_COLORS).sort()).toEqual([...expectedKeys].sort());
    });

    it('has no unexpected keys', () => {
      const allowedKeys = new Set<string>([
        'available',
        'in_service',
        'en_route',
        'at_scene',
        'maintenance',
        'offline',
      ]);
      Object.keys(STATUS_COLORS).forEach((key) => {
        expect(allowedKeys.has(key)).toBe(true);
      });
    });

    it('maps "available" to a green color class', () => {
      expect(STATUS_COLORS.available).toContain('green');
    });

    it('maps "in_service" to a blue color class', () => {
      expect(STATUS_COLORS.in_service).toContain('blue');
    });

    it('maps "en_route" to a yellow color class', () => {
      expect(STATUS_COLORS.en_route).toContain('yellow');
    });

    it('maps "at_scene" to an orange color class', () => {
      expect(STATUS_COLORS.at_scene).toContain('orange');
    });

    it('maps "maintenance" to a gray color class', () => {
      expect(STATUS_COLORS.maintenance).toContain('gray');
    });

    it('maps "offline" to a red color class', () => {
      expect(STATUS_COLORS.offline).toContain('red');
    });

    it.each(Object.entries(expectedColors))(
      'maps "%s" to exactly "%s"',
      (status, color) => {
        expect(STATUS_COLORS[status as VehicleStatus]).toBe(color);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // SEVERITY_COLORS
  // ---------------------------------------------------------------------------
  describe('SEVERITY_COLORS', () => {
    const expectedColors: Record<Severity, string> = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
    };

    it('contains exactly 3 entries', () => {
      expect(Object.keys(SEVERITY_COLORS)).toHaveLength(3);
    });

    it('has all expected severity keys', () => {
      const expectedKeys: Severity[] = ['info', 'warning', 'critical'];
      expect(Object.keys(SEVERITY_COLORS).sort()).toEqual([...expectedKeys].sort());
    });

    it('has no unexpected keys', () => {
      const allowedKeys = new Set<string>(['info', 'warning', 'critical']);
      Object.keys(SEVERITY_COLORS).forEach((key) => {
        expect(allowedKeys.has(key)).toBe(true);
      });
    });

    it('maps "info" to a blue color class', () => {
      expect(SEVERITY_COLORS.info).toContain('blue');
    });

    it('maps "warning" to a yellow color class', () => {
      expect(SEVERITY_COLORS.warning).toContain('yellow');
    });

    it('maps "critical" to a red color class', () => {
      expect(SEVERITY_COLORS.critical).toContain('red');
    });

    it('"info" includes both background and text color classes', () => {
      expect(SEVERITY_COLORS.info).toContain('bg-blue-100');
      expect(SEVERITY_COLORS.info).toContain('text-blue-800');
    });

    it('"warning" includes both background and text color classes', () => {
      expect(SEVERITY_COLORS.warning).toContain('bg-yellow-100');
      expect(SEVERITY_COLORS.warning).toContain('text-yellow-800');
    });

    it('"critical" includes both background and text color classes', () => {
      expect(SEVERITY_COLORS.critical).toContain('bg-red-100');
      expect(SEVERITY_COLORS.critical).toContain('text-red-800');
    });

    it.each(Object.entries(expectedColors))(
      'maps "%s" to exactly "%s"',
      (severity, color) => {
        expect(SEVERITY_COLORS[severity as Severity]).toBe(color);
      },
    );
  });
});

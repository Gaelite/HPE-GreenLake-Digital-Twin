import {
  haversineDistance,
  runDispatchComparison,
  runResourceDepletion,
  runTrafficImpact,
  VehicleState,
  DispatchComparisonParams,
  ResourceDepletionParams,
  TrafficImpactParams,
} from '@/lib/simulation-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a VehicleState with sensible defaults that can be selectively
 * overridden per-test.
 */
function makeVehicle(overrides: Partial<VehicleState> = {}): VehicleState {
  return {
    vehicle_id: 'v-1',
    name: 'Unit Alpha',
    latitude: 40.4168,
    longitude: -3.7038,
    current_fuel: 80,
    avg_speed_kmh: 80,
    fuel_consumption_rate: 0.15,
    risk_score: 20,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. haversineDistance
// ---------------------------------------------------------------------------

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    const d = haversineDistance(40.4168, -3.7038, 40.4168, -3.7038);
    expect(d).toBe(0);
  });

  it('computes Madrid to Barcelona (~505 km) within a reasonable tolerance', () => {
    // Madrid: 40.4168 N, 3.7038 W  |  Barcelona: 41.3874 N, 2.1686 E
    const d = haversineDistance(40.4168, -3.7038, 41.3874, 2.1686);
    expect(d).toBeGreaterThan(490);
    expect(d).toBeLessThan(520);
  });

  it('computes a short intra-city distance (a few km)', () => {
    // Two points roughly 2-3 km apart inside Madrid
    const d = haversineDistance(40.4168, -3.7038, 40.4300, -3.6850);
    expect(d).toBeGreaterThan(1);
    expect(d).toBeLessThan(5);
  });

  it('handles negative coordinates (Southern / Western hemispheres)', () => {
    // Buenos Aires (-34.6037, -58.3816) to Sao Paulo (-23.5505, -46.6333)
    // Haversine great-circle distance is ~1675 km
    const d = haversineDistance(-34.6037, -58.3816, -23.5505, -46.6333);
    expect(d).toBeGreaterThan(1650);
    expect(d).toBeLessThan(1700);
  });

  it('returns the same distance regardless of argument order (symmetry)', () => {
    const d1 = haversineDistance(40.4168, -3.7038, 41.3874, 2.1686);
    const d2 = haversineDistance(41.3874, 2.1686, 40.4168, -3.7038);
    expect(d1).toBeCloseTo(d2, 10);
  });

  it('handles antipodal points (~20 000 km)', () => {
    // North Pole to South Pole
    const d = haversineDistance(90, 0, -90, 0);
    expect(d).toBeGreaterThan(19_900);
    expect(d).toBeLessThan(20_100);
  });

  it('handles crossing the date line (positive to negative longitude)', () => {
    // Auckland (NZ) to Fiji
    const d = haversineDistance(-36.8485, 174.7633, -17.7134, 177.9756);
    expect(d).toBeGreaterThan(2_100);
    expect(d).toBeLessThan(2_200);
  });
});

// ---------------------------------------------------------------------------
// 2. runDispatchComparison
// ---------------------------------------------------------------------------

describe('runDispatchComparison', () => {
  const incidentLat = 40.453;
  const incidentLng = -3.6883;

  it('recommends the closer vehicle when one is nearer', () => {
    const closer = makeVehicle({
      vehicle_id: 'v-close',
      name: 'Close Unit',
      latitude: 40.45,
      longitude: -3.69,
    });
    const farther = makeVehicle({
      vehicle_id: 'v-far',
      name: 'Far Unit',
      latitude: 41.0,
      longitude: -3.0,
    });

    const result = runDispatchComparison({
      vehicles: [closer, farther],
      incident_latitude: incidentLat,
      incident_longitude: incidentLng,
      traffic_factor: 1.0,
    });

    expect(result.type).toBe('dispatch_comparison');
    expect(result.vehicles).toHaveLength(2);

    const [closeResult, farResult] = result.vehicles;
    expect(closeResult.recommended).toBe(true);
    expect(farResult.recommended).toBe(false);
    expect(closeResult.estimated_response_time_min).toBeLessThan(
      farResult.estimated_response_time_min
    );
    expect(result.recommendation).toContain('Close Unit');
  });

  it('recommends the second vehicle when it is closer', () => {
    const farther = makeVehicle({
      vehicle_id: 'v-far',
      name: 'Far Unit',
      latitude: 41.0,
      longitude: -3.0,
    });
    const closer = makeVehicle({
      vehicle_id: 'v-close',
      name: 'Close Unit',
      latitude: 40.45,
      longitude: -3.69,
    });

    const result = runDispatchComparison({
      vehicles: [farther, closer],
      incident_latitude: incidentLat,
      incident_longitude: incidentLng,
      traffic_factor: 1.0,
    });

    expect(result.vehicles[0].recommended).toBe(false);
    expect(result.vehicles[1].recommended).toBe(true);
    expect(result.recommendation).toContain('Close Unit');
  });

  it('increases ETA proportionally with traffic_factor', () => {
    const vehicleA = makeVehicle({ vehicle_id: 'v-a', name: 'A' });
    const vehicleB = makeVehicle({ vehicle_id: 'v-b', name: 'B', latitude: 41.0 });

    const baseline = runDispatchComparison({
      vehicles: [vehicleA, vehicleB],
      incident_latitude: incidentLat,
      incident_longitude: incidentLng,
      traffic_factor: 1.0,
    });

    const heavy = runDispatchComparison({
      vehicles: [vehicleA, vehicleB],
      incident_latitude: incidentLat,
      incident_longitude: incidentLng,
      traffic_factor: 2.0,
    });

    // Each vehicle's ETA at traffic_factor=2 should be double the factor=1 ETA
    expect(heavy.vehicles[0].estimated_response_time_min).toBeCloseTo(
      baseline.vehicles[0].estimated_response_time_min * 2,
      1
    );
    expect(heavy.vehicles[1].estimated_response_time_min).toBeCloseTo(
      baseline.vehicles[1].estimated_response_time_min * 2,
      1
    );
  });

  it('calculates fuel consumption as distance * fuel_consumption_rate', () => {
    const rate = 0.2; // litres per km
    const vehicle = makeVehicle({
      vehicle_id: 'v-1',
      name: 'Alpha',
      fuel_consumption_rate: rate,
      latitude: 40.4168,
      longitude: -3.7038,
    });
    const dummy = makeVehicle({
      vehicle_id: 'v-2',
      name: 'Beta',
      fuel_consumption_rate: rate,
      latitude: 41.0,
      longitude: -3.0,
    });

    const result = runDispatchComparison({
      vehicles: [vehicle, dummy],
      incident_latitude: incidentLat,
      incident_longitude: incidentLng,
      traffic_factor: 1.0,
    });

    // fuel_consumption_litres should equal distance_km * rate (both rounded to 2 dp)
    for (const v of result.vehicles) {
      const expectedConsumption = Math.round(v.distance_km * rate * 100) / 100;
      expect(v.fuel_consumption_litres).toBeCloseTo(expectedConsumption, 1);
    }
  });

  it('returns exactly two vehicle results with one marked recommended', () => {
    const a = makeVehicle({ vehicle_id: 'a', name: 'Alpha' });
    const b = makeVehicle({ vehicle_id: 'b', name: 'Beta', latitude: 41.0 });

    const result = runDispatchComparison({
      vehicles: [a, b],
      incident_latitude: incidentLat,
      incident_longitude: incidentLng,
      traffic_factor: 1.0,
    });

    expect(result.vehicles).toHaveLength(2);
    const recommendedCount = result.vehicles.filter((v) => v.recommended).length;
    expect(recommendedCount).toBe(1);
  });

  it('reports a positive distance and ETA for each vehicle', () => {
    const a = makeVehicle({ vehicle_id: 'a', name: 'Alpha' });
    const b = makeVehicle({ vehicle_id: 'b', name: 'Beta', latitude: 41.0 });

    const result = runDispatchComparison({
      vehicles: [a, b],
      incident_latitude: incidentLat,
      incident_longitude: incidentLng,
      traffic_factor: 1.2,
    });

    for (const v of result.vehicles) {
      expect(v.distance_km).toBeGreaterThan(0);
      expect(v.estimated_response_time_min).toBeGreaterThan(0);
      expect(v.fuel_consumption_litres).toBeGreaterThan(0);
    }
  });

  it('calculates fuel_remaining_pct assuming a 60L tank', () => {
    const vehicle = makeVehicle({
      vehicle_id: 'v-1',
      name: 'Alpha',
      current_fuel: 100, // 100% = 60L
      fuel_consumption_rate: 0.15,
    });
    const dummy = makeVehicle({ vehicle_id: 'v-2', name: 'Beta' });

    const result = runDispatchComparison({
      vehicles: [vehicle, dummy],
      incident_latitude: incidentLat,
      incident_longitude: incidentLng,
      traffic_factor: 1.0,
    });

    const vResult = result.vehicles[0];
    const expectedRemainingLitres = 60 - vResult.fuel_consumption_litres;
    const expectedRemainingPct =
      Math.round(Math.max(0, (expectedRemainingLitres / 60) * 100) * 100) / 100;
    expect(vResult.fuel_remaining_pct).toBeCloseTo(expectedRemainingPct, 1);
  });

  it('clamps fuel_remaining_pct to 0 when fuel consumption exceeds tank', () => {
    // Very high consumption rate + low fuel to force negative before clamping
    const vehicle = makeVehicle({
      vehicle_id: 'v-1',
      name: 'Guzzler',
      current_fuel: 5, // 5% of 60L = 3L
      fuel_consumption_rate: 1.0, // 1 L per km — extreme
      latitude: 41.0, // far away
      longitude: -3.0,
    });
    const dummy = makeVehicle({ vehicle_id: 'v-2', name: 'Dummy' });

    const result = runDispatchComparison({
      vehicles: [vehicle, dummy],
      incident_latitude: incidentLat,
      incident_longitude: incidentLng,
      traffic_factor: 1.0,
    });

    expect(result.vehicles[0].fuel_remaining_pct).toBe(0);
  });

  it('resolves equal ETA in favour of first vehicle (<=)', () => {
    // Two identical vehicles at the same location should give equal ETA.
    // The implementation uses <= so index 0 wins ties.
    const a = makeVehicle({ vehicle_id: 'a', name: 'Alpha' });
    const b = makeVehicle({ vehicle_id: 'b', name: 'Beta' });

    const result = runDispatchComparison({
      vehicles: [a, b],
      incident_latitude: incidentLat,
      incident_longitude: incidentLng,
      traffic_factor: 1.0,
    });

    expect(result.vehicles[0].recommended).toBe(true);
    expect(result.vehicles[1].recommended).toBe(false);
  });

  it('populates the recommendation string with ETA, distance, and fuel', () => {
    const a = makeVehicle({ vehicle_id: 'a', name: 'Engine 7' });
    const b = makeVehicle({ vehicle_id: 'b', name: 'Rescue 3', latitude: 41.0 });

    const result = runDispatchComparison({
      vehicles: [a, b],
      incident_latitude: incidentLat,
      incident_longitude: incidentLng,
      traffic_factor: 1.0,
    });

    expect(result.recommendation).toContain('is recommended');
    expect(result.recommendation).toContain('min ETA');
    expect(result.recommendation).toContain('km away');
    expect(result.recommendation).toContain('fuel remaining');
  });
});

// ---------------------------------------------------------------------------
// 3. runResourceDepletion
// ---------------------------------------------------------------------------

describe('runResourceDepletion', () => {
  it('returns will_complete=true and risk=low when fuel is plentiful', () => {
    const result = runResourceDepletion({
      vehicle_id: 'v-1',
      vehicle_name: 'Engine 1',
      current_fuel_litres: 50,
      fuel_tank_capacity_litres: 60,
      consumption_rate_per_km: 0.15,
      remaining_distance_km: 100,
    });

    // needs 15L, has 50L => 35L left => 58.3%
    expect(result.type).toBe('resource_depletion');
    expect(result.will_complete).toBe(true);
    expect(result.risk).toBe('low');
    expect(result.fuel_at_arrival_litres).toBeCloseTo(35, 1);
    expect(result.fuel_at_arrival_pct).toBeCloseTo(58.33, 0);
    expect(result.fuel_deficit_litres).toBe(0);
    expect(result.outcome_summary).toContain('sufficient fuel');
  });

  it('returns will_complete=false and risk=critical when fuel is insufficient', () => {
    const result = runResourceDepletion({
      vehicle_id: 'v-2',
      vehicle_name: 'Rescue 5',
      current_fuel_litres: 10,
      fuel_tank_capacity_litres: 60,
      consumption_rate_per_km: 0.15,
      remaining_distance_km: 200,
    });

    // needs 30L, only has 10L => deficit 20L
    expect(result.will_complete).toBe(false);
    expect(result.risk).toBe('critical');
    expect(result.fuel_at_arrival_litres).toBe(0);
    expect(result.fuel_deficit_litres).toBeCloseTo(20, 1);
    expect(result.outcome_summary).toContain('will NOT complete');
    expect(result.outcome_summary).toContain('Refueling required');
  });

  it('returns risk=high when fuel at arrival is below 10%', () => {
    // Target: barely completes with < 10% remaining
    // Tank = 60L, need arrival at ~5% = 3L remaining
    // consumption = 0.15 L/km, distance such that fuel_used = 47L => remaining 3L
    // distance = 47 / 0.15 = 313.33 km
    const result = runResourceDepletion({
      vehicle_id: 'v-3',
      vehicle_name: 'Ladder 2',
      current_fuel_litres: 50,
      fuel_tank_capacity_litres: 60,
      consumption_rate_per_km: 0.15,
      remaining_distance_km: 313.33,
    });

    // fuel_needed = 313.33 * 0.15 = 47.0L, remaining = 50 - 47 = 3L => 5%
    expect(result.will_complete).toBe(true);
    expect(result.risk).toBe('high');
    expect(result.fuel_at_arrival_pct).toBeLessThan(10);
    expect(result.fuel_at_arrival_pct).toBeGreaterThan(0);
    expect(result.outcome_summary).toContain('critically low fuel');
  });

  it('returns risk=medium when fuel at arrival is between 10% and 25%', () => {
    // Target: 15% remaining = 9L
    // fuel_used = 50 - 9 = 41L, distance = 41 / 0.15 = 273.33 km
    const result = runResourceDepletion({
      vehicle_id: 'v-4',
      vehicle_name: 'Ambulance 3',
      current_fuel_litres: 50,
      fuel_tank_capacity_litres: 60,
      consumption_rate_per_km: 0.15,
      remaining_distance_km: 273.33,
    });

    // fuel_needed = 41.0L, remaining = 9L => 15%
    expect(result.will_complete).toBe(true);
    expect(result.risk).toBe('medium');
    expect(result.fuel_at_arrival_pct).toBeGreaterThanOrEqual(10);
    expect(result.fuel_at_arrival_pct).toBeLessThan(25);
    expect(result.outcome_summary).toContain('Refueling recommended');
  });

  it('clamps fuel_at_arrival_litres to 0 (never negative)', () => {
    const result = runResourceDepletion({
      vehicle_id: 'v-5',
      vehicle_name: 'Unit X',
      current_fuel_litres: 5,
      fuel_tank_capacity_litres: 60,
      consumption_rate_per_km: 0.5,
      remaining_distance_km: 100,
    });

    // needs 50L, has 5L
    expect(result.fuel_at_arrival_litres).toBe(0);
    expect(result.fuel_at_arrival_pct).toBe(0);
    expect(result.will_complete).toBe(false);
  });

  it('calculates fuel_deficit_litres only when vehicle cannot complete', () => {
    const completes = runResourceDepletion({
      vehicle_id: 'v-ok',
      vehicle_name: 'OK',
      current_fuel_litres: 50,
      fuel_tank_capacity_litres: 60,
      consumption_rate_per_km: 0.1,
      remaining_distance_km: 100,
    });
    expect(completes.fuel_deficit_litres).toBe(0);

    const fails = runResourceDepletion({
      vehicle_id: 'v-fail',
      vehicle_name: 'Fail',
      current_fuel_litres: 5,
      fuel_tank_capacity_litres: 60,
      consumption_rate_per_km: 0.1,
      remaining_distance_km: 100,
    });
    // needs 10L, has 5L => deficit 5L
    expect(fails.fuel_deficit_litres).toBeCloseTo(5, 1);
  });

  it('handles zero remaining distance (arrival is immediate)', () => {
    const result = runResourceDepletion({
      vehicle_id: 'v-0',
      vehicle_name: 'Already There',
      current_fuel_litres: 30,
      fuel_tank_capacity_litres: 60,
      consumption_rate_per_km: 0.15,
      remaining_distance_km: 0,
    });

    expect(result.will_complete).toBe(true);
    expect(result.fuel_at_arrival_litres).toBeCloseTo(30, 1);
    expect(result.fuel_at_arrival_pct).toBeCloseTo(50, 1);
    expect(result.risk).toBe('low');
  });

  it('handles zero tank capacity gracefully (fuel_at_arrival_pct = 0)', () => {
    const result = runResourceDepletion({
      vehicle_id: 'v-edge',
      vehicle_name: 'Edge',
      current_fuel_litres: 0,
      fuel_tank_capacity_litres: 0,
      consumption_rate_per_km: 0.15,
      remaining_distance_km: 0,
    });

    expect(result.fuel_at_arrival_pct).toBe(0);
  });

  it('returns correct type field', () => {
    const result = runResourceDepletion({
      vehicle_id: 'v-t',
      vehicle_name: 'Type Check',
      current_fuel_litres: 50,
      fuel_tank_capacity_litres: 60,
      consumption_rate_per_km: 0.15,
      remaining_distance_km: 10,
    });
    expect(result.type).toBe('resource_depletion');
  });

  it('preserves vehicle_id and vehicle_name in the result', () => {
    const result = runResourceDepletion({
      vehicle_id: 'unit-42',
      vehicle_name: 'Firetruck Delta',
      current_fuel_litres: 50,
      fuel_tank_capacity_litres: 60,
      consumption_rate_per_km: 0.15,
      remaining_distance_km: 10,
    });
    expect(result.vehicle_id).toBe('unit-42');
    expect(result.vehicle_name).toBe('Firetruck Delta');
  });
});

// ---------------------------------------------------------------------------
// 4. runTrafficImpact
// ---------------------------------------------------------------------------

describe('runTrafficImpact', () => {
  it('returns the same response time when traffic increase is 0%', () => {
    const result = runTrafficImpact({
      vehicle_id: 'v-1',
      vehicle_name: 'Engine 1',
      current_response_time_min: 10,
      traffic_increase_pct: 0,
    });

    expect(result.type).toBe('traffic_impact');
    expect(result.new_response_time_min).toBe(10);
    expect(result.delay_minutes).toBe(0);
    expect(result.traffic_factor).toBe(1);
    expect(result.risk).toBe('low');
    expect(result.original_response_time_min).toBe(10);
  });

  it('returns 15 min and risk=medium for 50% increase on 10 min base', () => {
    const result = runTrafficImpact({
      vehicle_id: 'v-2',
      vehicle_name: 'Rescue 3',
      current_response_time_min: 10,
      traffic_increase_pct: 50,
    });

    expect(result.new_response_time_min).toBe(15);
    expect(result.delay_minutes).toBe(5);
    expect(result.traffic_factor).toBe(1.5);
    expect(result.risk).toBe('medium');
    expect(result.outcome_summary).toContain('Moderate traffic impact');
  });

  it('returns risk=critical when new time exceeds 25 min', () => {
    const result = runTrafficImpact({
      vehicle_id: 'v-3',
      vehicle_name: 'Unit Heavy',
      current_response_time_min: 20,
      traffic_increase_pct: 50,
    });

    // 20 * 1.5 = 30 min
    expect(result.new_response_time_min).toBe(30);
    expect(result.delay_minutes).toBe(10);
    expect(result.risk).toBe('critical');
    expect(result.outcome_summary).toContain('CRITICAL');
    expect(result.outcome_summary).toContain('Consider dispatching a closer unit');
  });

  it('returns risk=low when the new time stays at or below 12 min', () => {
    const result = runTrafficImpact({
      vehicle_id: 'v-4',
      vehicle_name: 'Fast Responder',
      current_response_time_min: 8,
      traffic_increase_pct: 25,
    });

    // 8 * 1.25 = 10 min
    expect(result.new_response_time_min).toBe(10);
    expect(result.risk).toBe('low');
    expect(result.outcome_summary).toContain('Minimal traffic impact');
  });

  it('returns risk=high when new time is between 18 and 25 min', () => {
    const result = runTrafficImpact({
      vehicle_id: 'v-5',
      vehicle_name: 'Medic 9',
      current_response_time_min: 15,
      traffic_increase_pct: 40,
    });

    // 15 * 1.4 = 21 min
    expect(result.new_response_time_min).toBe(21);
    expect(result.risk).toBe('high');
    expect(result.outcome_summary).toContain('Alternative routes recommended');
  });

  it('computes delay_minutes as the difference between new and original', () => {
    const result = runTrafficImpact({
      vehicle_id: 'v-d',
      vehicle_name: 'Delay Test',
      current_response_time_min: 12,
      traffic_increase_pct: 100,
    });

    // 12 * 2 = 24, delay = 12
    expect(result.delay_minutes).toBe(12);
    expect(result.new_response_time_min).toBe(24);
  });

  it('preserves vehicle_id, vehicle_name, and original time in the result', () => {
    const result = runTrafficImpact({
      vehicle_id: 'id-abc',
      vehicle_name: 'Ambulance Zulu',
      current_response_time_min: 7.5,
      traffic_increase_pct: 20,
    });

    expect(result.vehicle_id).toBe('id-abc');
    expect(result.vehicle_name).toBe('Ambulance Zulu');
    expect(result.original_response_time_min).toBe(7.5);
  });

  it('rounds output values to two decimal places', () => {
    const result = runTrafficImpact({
      vehicle_id: 'v-r',
      vehicle_name: 'Rounding',
      current_response_time_min: 7,
      traffic_increase_pct: 33,
    });

    // 7 * 1.33 = 9.31, delay = 2.31, factor = 1.33
    const decimalPlaces = (n: number) => {
      const s = n.toString();
      if (!s.includes('.')) return 0;
      return s.split('.')[1].length;
    };

    expect(decimalPlaces(result.new_response_time_min)).toBeLessThanOrEqual(2);
    expect(decimalPlaces(result.delay_minutes)).toBeLessThanOrEqual(2);
    expect(decimalPlaces(result.traffic_factor)).toBeLessThanOrEqual(2);
  });

  it('handles the boundary at exactly 12 min (should be low, not medium)', () => {
    // risk is medium when > 12, so exactly 12 should be low
    const result = runTrafficImpact({
      vehicle_id: 'v-b12',
      vehicle_name: 'Boundary 12',
      current_response_time_min: 12,
      traffic_increase_pct: 0,
    });

    expect(result.new_response_time_min).toBe(12);
    expect(result.risk).toBe('low');
  });

  it('handles the boundary at exactly 18 min (should be medium, not high)', () => {
    // risk is high when > 18, so exactly 18 should be medium
    const result = runTrafficImpact({
      vehicle_id: 'v-b18',
      vehicle_name: 'Boundary 18',
      current_response_time_min: 18,
      traffic_increase_pct: 0,
    });

    expect(result.new_response_time_min).toBe(18);
    expect(result.risk).toBe('medium');
  });

  it('handles the boundary at exactly 25 min (should be high, not critical)', () => {
    // risk is critical when > 25, so exactly 25 should be high
    const result = runTrafficImpact({
      vehicle_id: 'v-b25',
      vehicle_name: 'Boundary 25',
      current_response_time_min: 25,
      traffic_increase_pct: 0,
    });

    expect(result.new_response_time_min).toBe(25);
    expect(result.risk).toBe('high');
  });

  it('handles a very large traffic increase', () => {
    const result = runTrafficImpact({
      vehicle_id: 'v-huge',
      vehicle_name: 'Mega Delay',
      current_response_time_min: 5,
      traffic_increase_pct: 1000,
    });

    // 5 * 11 = 55 min
    expect(result.new_response_time_min).toBe(55);
    expect(result.risk).toBe('critical');
  });
});

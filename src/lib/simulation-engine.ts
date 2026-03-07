// ============================================================
// Simulation Engine — "What If" Scenario Calculations
// ============================================================

// ----- Haversine Distance (km) -----
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ----- Types for simulation parameters & results -----

export interface VehicleState {
  vehicle_id: string;
  name: string;
  latitude: number;
  longitude: number;
  current_fuel: number; // percentage 0-100
  avg_speed_kmh: number;
  fuel_consumption_rate: number; // litres per km
  risk_score: number; // 0-100
}

export interface DispatchComparisonParams {
  vehicles: [VehicleState, VehicleState];
  incident_latitude: number;
  incident_longitude: number;
  traffic_factor: number; // 1.0 = normal, 1.5 = 50% slower, etc.
}

export interface DispatchVehicleResult {
  vehicle_id: string;
  vehicle_name: string;
  distance_km: number;
  estimated_response_time_min: number;
  fuel_consumption_litres: number;
  fuel_remaining_pct: number;
  risk_delta: number;
  recommended: boolean;
}

export interface DispatchComparisonResult {
  type: 'dispatch_comparison';
  vehicles: [DispatchVehicleResult, DispatchVehicleResult];
  recommendation: string;
}

export interface ResourceDepletionParams {
  vehicle_id: string;
  vehicle_name: string;
  current_fuel_litres: number;
  fuel_tank_capacity_litres: number;
  consumption_rate_per_km: number;
  remaining_distance_km: number;
}

export interface ResourceDepletionResult {
  type: 'resource_depletion';
  vehicle_id: string;
  vehicle_name: string;
  will_complete: boolean;
  fuel_at_arrival_litres: number;
  fuel_at_arrival_pct: number;
  fuel_deficit_litres: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  outcome_summary: string;
}

export interface TrafficImpactParams {
  vehicle_id: string;
  vehicle_name: string;
  current_response_time_min: number;
  traffic_increase_pct: number; // e.g. 30 means 30% increase
}

export interface TrafficImpactResult {
  type: 'traffic_impact';
  vehicle_id: string;
  vehicle_name: string;
  original_response_time_min: number;
  new_response_time_min: number;
  delay_minutes: number;
  traffic_factor: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  outcome_summary: string;
}

// ----- Simulation Functions -----

export function runDispatchComparison(
  params: DispatchComparisonParams
): DispatchComparisonResult {
  const { vehicles, incident_latitude, incident_longitude, traffic_factor } =
    params;

  const results = vehicles.map((v) => {
    const distance_km = haversineDistance(
      v.latitude,
      v.longitude,
      incident_latitude,
      incident_longitude
    );

    // Response time = distance / speed * traffic factor, converted to minutes
    const estimated_response_time_min =
      (distance_km / v.avg_speed_kmh) * 60 * traffic_factor;

    const fuel_consumption_litres = distance_km * v.fuel_consumption_rate;

    // Fuel remaining after dispatch (assuming 60L tank at current_fuel %)
    const tank_litres = 60; // standard tank
    const current_litres = (v.current_fuel / 100) * tank_litres;
    const remaining_litres = current_litres - fuel_consumption_litres;
    const fuel_remaining_pct = Math.max(
      0,
      (remaining_litres / tank_litres) * 100
    );

    // Risk delta: how much risk changes. Higher fuel use + longer time = higher risk
    const time_risk = estimated_response_time_min > 15 ? 20 : estimated_response_time_min > 10 ? 10 : 0;
    const fuel_risk = fuel_remaining_pct < 20 ? 25 : fuel_remaining_pct < 40 ? 10 : 0;
    const risk_delta = v.risk_score + time_risk + fuel_risk - v.risk_score;

    return {
      vehicle_id: v.vehicle_id,
      vehicle_name: v.name,
      distance_km: Math.round(distance_km * 100) / 100,
      estimated_response_time_min:
        Math.round(estimated_response_time_min * 100) / 100,
      fuel_consumption_litres:
        Math.round(fuel_consumption_litres * 100) / 100,
      fuel_remaining_pct: Math.round(fuel_remaining_pct * 100) / 100,
      risk_delta: Math.round(risk_delta * 100) / 100,
      recommended: false, // will be set below
    };
  }) as [DispatchVehicleResult, DispatchVehicleResult];

  // The recommended vehicle has lower response time; ties broken by fuel remaining
  const bestIdx =
    results[0].estimated_response_time_min <=
    results[1].estimated_response_time_min
      ? 0
      : 1;
  results[bestIdx].recommended = true;

  const best = results[bestIdx];
  const recommendation = `${best.vehicle_name} is recommended — ${best.estimated_response_time_min.toFixed(1)} min ETA, ${best.distance_km.toFixed(1)} km away, ${best.fuel_remaining_pct.toFixed(0)}% fuel remaining after dispatch.`;

  return { type: 'dispatch_comparison', vehicles: results, recommendation };
}

export function runResourceDepletion(
  params: ResourceDepletionParams
): ResourceDepletionResult {
  const {
    vehicle_id,
    vehicle_name,
    current_fuel_litres,
    fuel_tank_capacity_litres,
    consumption_rate_per_km,
    remaining_distance_km,
  } = params;

  const fuel_needed = remaining_distance_km * consumption_rate_per_km;
  const fuel_at_arrival_litres = Math.max(0, current_fuel_litres - fuel_needed);
  const fuel_at_arrival_pct =
    fuel_tank_capacity_litres > 0
      ? (fuel_at_arrival_litres / fuel_tank_capacity_litres) * 100
      : 0;
  const will_complete = current_fuel_litres >= fuel_needed;
  const fuel_deficit_litres = will_complete
    ? 0
    : Math.round((fuel_needed - current_fuel_litres) * 100) / 100;

  let risk: 'low' | 'medium' | 'high' | 'critical';
  if (!will_complete) {
    risk = 'critical';
  } else if (fuel_at_arrival_pct < 10) {
    risk = 'high';
  } else if (fuel_at_arrival_pct < 25) {
    risk = 'medium';
  } else {
    risk = 'low';
  }

  let outcome_summary: string;
  if (!will_complete) {
    outcome_summary = `${vehicle_name} will NOT complete the trip. Fuel deficit: ${fuel_deficit_litres.toFixed(1)}L. Refueling required before dispatch.`;
  } else if (risk === 'high') {
    outcome_summary = `${vehicle_name} will arrive with critically low fuel (${fuel_at_arrival_pct.toFixed(1)}%). Consider refueling options along the route.`;
  } else if (risk === 'medium') {
    outcome_summary = `${vehicle_name} will complete the trip with ${fuel_at_arrival_pct.toFixed(1)}% fuel remaining. Refueling recommended soon after arrival.`;
  } else {
    outcome_summary = `${vehicle_name} has sufficient fuel. Estimated ${fuel_at_arrival_pct.toFixed(1)}% remaining on arrival.`;
  }

  return {
    type: 'resource_depletion',
    vehicle_id,
    vehicle_name,
    will_complete,
    fuel_at_arrival_litres: Math.round(fuel_at_arrival_litres * 100) / 100,
    fuel_at_arrival_pct: Math.round(fuel_at_arrival_pct * 100) / 100,
    fuel_deficit_litres,
    risk,
    outcome_summary,
  };
}

export function runTrafficImpact(
  params: TrafficImpactParams
): TrafficImpactResult {
  const { vehicle_id, vehicle_name, current_response_time_min, traffic_increase_pct } =
    params;

  const traffic_factor = 1 + traffic_increase_pct / 100;
  const new_response_time_min = current_response_time_min * traffic_factor;
  const delay_minutes = new_response_time_min - current_response_time_min;

  let risk: 'low' | 'medium' | 'high' | 'critical';
  if (new_response_time_min > 25) {
    risk = 'critical';
  } else if (new_response_time_min > 18) {
    risk = 'high';
  } else if (new_response_time_min > 12) {
    risk = 'medium';
  } else {
    risk = 'low';
  }

  let outcome_summary: string;
  if (risk === 'critical') {
    outcome_summary = `Traffic increase of ${traffic_increase_pct}% pushes ${vehicle_name} response time to ${new_response_time_min.toFixed(1)} min — CRITICAL. Consider dispatching a closer unit.`;
  } else if (risk === 'high') {
    outcome_summary = `Traffic increase of ${traffic_increase_pct}% adds ${delay_minutes.toFixed(1)} min delay for ${vehicle_name}. Response time: ${new_response_time_min.toFixed(1)} min. Alternative routes recommended.`;
  } else if (risk === 'medium') {
    outcome_summary = `Moderate traffic impact for ${vehicle_name}: +${delay_minutes.toFixed(1)} min delay. Total response time: ${new_response_time_min.toFixed(1)} min.`;
  } else {
    outcome_summary = `Minimal traffic impact for ${vehicle_name}. Response time increases from ${current_response_time_min.toFixed(1)} to ${new_response_time_min.toFixed(1)} min.`;
  }

  return {
    type: 'traffic_impact',
    vehicle_id,
    vehicle_name,
    original_response_time_min:
      Math.round(current_response_time_min * 100) / 100,
    new_response_time_min: Math.round(new_response_time_min * 100) / 100,
    delay_minutes: Math.round(delay_minutes * 100) / 100,
    traffic_factor: Math.round(traffic_factor * 100) / 100,
    risk,
    outcome_summary,
  };
}

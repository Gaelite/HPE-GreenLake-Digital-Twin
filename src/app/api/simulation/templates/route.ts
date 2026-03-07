import { NextResponse } from 'next/server';
import type { ScenarioType } from '@/types';

export interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  scenario_type: ScenarioType;
  icon: string;
  parameters: Record<string, unknown>;
}

const TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'tpl-dispatch-nearest',
    name: 'Nearest Vehicle Dispatch',
    description:
      'Compare two vehicles for a downtown incident. Tests which unit arrives faster under normal traffic conditions.',
    scenario_type: 'dispatch_comparison',
    icon: 'truck',
    parameters: {
      vehicles: [
        {
          vehicle_id: 'a1b2c3d4-0004-4000-8000-000000000004', // Medic One
          name: 'Medic One',
          latitude: 40.4092,
          longitude: -3.6935,
          current_fuel: 85,
          avg_speed_kmh: 60,
          fuel_consumption_rate: 0.15,
          risk_score: 15,
        },
        {
          vehicle_id: 'a1b2c3d4-0001-4000-8000-000000000001', // Alpha Patrol
          name: 'Alpha Patrol',
          latitude: 40.4168,
          longitude: -3.7038,
          current_fuel: 75,
          avg_speed_kmh: 70,
          fuel_consumption_rate: 0.13,
          risk_score: 12,
        },
      ],
      incident_latitude: 40.4168,
      incident_longitude: -3.7038,
      traffic_factor: 1.0,
    },
  },
  {
    id: 'tpl-dispatch-rush-hour',
    name: 'Rush Hour Dispatch',
    description:
      'Dispatch comparison during peak traffic. Traffic factor set to 1.8x to simulate heavy congestion.',
    scenario_type: 'dispatch_comparison',
    icon: 'clock',
    parameters: {
      vehicles: [
        {
          vehicle_id: 'a1b2c3d4-0007-4000-8000-000000000007', // Engine 7
          name: 'Engine 7',
          latitude: 40.4225,
          longitude: -3.7180,
          current_fuel: 90,
          avg_speed_kmh: 45,
          fuel_consumption_rate: 0.35,
          risk_score: 10,
        },
        {
          vehicle_id: 'a1b2c3d4-0019-4000-8000-000000000019', // Inferno One
          name: 'Inferno One',
          latitude: 40.4345,
          longitude: -3.7248,
          current_fuel: 72,
          avg_speed_kmh: 45,
          fuel_consumption_rate: 0.32,
          risk_score: 8,
        },
      ],
      incident_latitude: 40.4300,
      incident_longitude: -3.7100,
      traffic_factor: 1.8,
    },
  },
  {
    id: 'tpl-fuel-critical',
    name: 'Low Fuel Emergency Run',
    description:
      'Can a vehicle with 15L fuel remaining complete a 90km route? Tests fuel depletion risk.',
    scenario_type: 'resource_depletion',
    icon: 'fuel',
    parameters: {
      vehicle_id: 'a1b2c3d4-0003-4000-8000-000000000003', // Charlie Watch
      vehicle_name: 'Charlie Watch',
      current_fuel_litres: 15,
      fuel_tank_capacity_litres: 52,
      consumption_rate_per_km: 0.14,
      remaining_distance_km: 90,
    },
  },
  {
    id: 'tpl-fuel-safe',
    name: 'Standard Fuel Check',
    description:
      'Routine fuel sufficiency check for a 40km hospital transfer with half-tank fuel.',
    scenario_type: 'resource_depletion',
    icon: 'fuel',
    parameters: {
      vehicle_id: 'a1b2c3d4-0006-4000-8000-000000000006', // Life Support
      vehicle_name: 'Life Support',
      current_fuel_litres: 40,
      fuel_tank_capacity_litres: 80,
      consumption_rate_per_km: 0.16,
      remaining_distance_km: 40,
    },
  },
  {
    id: 'tpl-traffic-surge',
    name: 'Traffic Surge Impact',
    description:
      'What happens if traffic increases by 50%? Assess the delay impact on current response time.',
    scenario_type: 'traffic_impact',
    icon: 'traffic',
    parameters: {
      vehicle_id: 'a1b2c3d4-0009-4000-8000-000000000009', // Shield Unit
      vehicle_name: 'Shield Unit',
      current_response_time_min: 12,
      traffic_increase_pct: 50,
    },
  },
];

export async function GET() {
  return NextResponse.json({ templates: TEMPLATES });
}
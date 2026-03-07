-- ============================================================
-- Digital Twin - Emergency Vehicles POC — Fleet Expansion
-- ============================================================
-- Migration: 00008_add_18_vehicles
-- Depends on: 00002_seed_data
-- Adds 18 new vehicles (IDs 0013-0030) to bring fleet from 12 to 30
-- Distribution: 3 police, 3 ambulance, 4 fire_truck, 4 civil_protection, 4 hybrid
-- All positions are realistic Madrid, Spain coordinates
-- ============================================================

-- ============================================================
-- VEHICLES (18 new vehicles across 5 types)
-- ============================================================

INSERT INTO vehicles (id, type, name, plate_number, status, year, make, model, specifications, current_latitude, current_longitude, risk_score)
VALUES
  -- --------------------------------------------------------
  -- Police vehicles (P-04 through P-06) — 3 new, total 6
  -- --------------------------------------------------------
  (
    'a1b2c3d4-0013-4000-8000-000000000013',
    'police',
    'Delta Squad',
    'P-04',
    'available',
    2024,
    'Skoda',
    'Superb Combi',
    '{
      "engine_displacement": 1984,
      "horsepower": 280,
      "top_speed_kmh": 240,
      "fuel_type": "diesel",
      "tank_capacity_liters": 66,
      "radio_system": "TETRA Digital",
      "sirens": true,
      "dash_cam": true,
      "license_plate_reader": true,
      "lightbar": "LED Hella RTK7",
      "pursuit_rated": true,
      "speed_radar": true,
      "onboard_computer": true
    }',
    40.4532,
    -3.6885,
    6
  ),
  (
    'a1b2c3d4-0014-4000-8000-000000000014',
    'police',
    'Echo Patrol',
    'P-05',
    'in_service',
    2023,
    'Peugeot',
    '508 SW GT',
    '{
      "engine_displacement": 1997,
      "horsepower": 225,
      "top_speed_kmh": 235,
      "fuel_type": "diesel",
      "tank_capacity_liters": 62,
      "radio_system": "TETRA Digital",
      "sirens": true,
      "dash_cam": true,
      "license_plate_reader": true,
      "lightbar": "LED Federal Signal Valor",
      "pursuit_rated": true,
      "body_cameras": 2,
      "night_vision_scope": true
    }',
    40.4081,
    -3.7452,
    19
  ),
  (
    'a1b2c3d4-0015-4000-8000-000000000015',
    'police',
    'Foxtrot Watch',
    'P-06',
    'available',
    2025,
    'Citroen',
    'C5 X Hybrid',
    '{
      "engine_displacement": 1598,
      "horsepower": 225,
      "top_speed_kmh": 220,
      "fuel_type": "hybrid",
      "tank_capacity_liters": 50,
      "battery_capacity_kwh": 12.4,
      "radio_system": "TETRA Digital",
      "sirens": true,
      "dash_cam": true,
      "body_cameras": 3,
      "lightbar": "LED Code 3 MR6",
      "pursuit_rated": false,
      "onboard_computer": true,
      "electric_range_km": 55
    }',
    40.3920,
    -3.7135,
    3
  ),

  -- --------------------------------------------------------
  -- Ambulances (A-04 through A-06) — 3 new, total 6
  -- --------------------------------------------------------
  (
    'a1b2c3d4-0016-4000-8000-000000000016',
    'ambulance',
    'Guardian Angel',
    'A-04',
    'available',
    2024,
    'Fiat',
    'Ducato Maxi',
    '{
      "engine_displacement": 2287,
      "horsepower": 180,
      "top_speed_kmh": 155,
      "fuel_type": "diesel",
      "tank_capacity_liters": 90,
      "patient_capacity": 2,
      "stretcher_count": 1,
      "life_support_level": "BLS",
      "oxygen_tank_liters": 45,
      "defibrillator": "Philips HeartStart FR3",
      "suction_unit": true,
      "climate_controlled_cabin": true,
      "stair_chair": true
    }',
    40.4405,
    -3.6710,
    9
  ),
  (
    'a1b2c3d4-0017-4000-8000-000000000017',
    'ambulance',
    'Swift Medic',
    'A-05',
    'in_service',
    2023,
    'Peugeot',
    'Boxer L3H2',
    '{
      "engine_displacement": 2179,
      "horsepower": 165,
      "top_speed_kmh": 150,
      "fuel_type": "diesel",
      "tank_capacity_liters": 90,
      "patient_capacity": 1,
      "stretcher_count": 1,
      "life_support_level": "ALS",
      "oxygen_tank_liters": 50,
      "defibrillator": "Zoll AED 3",
      "ventilator": "Dräger Oxylog 3000",
      "suction_unit": true,
      "climate_controlled_cabin": true,
      "blood_analyzer": true
    }',
    40.4188,
    -3.6605,
    24
  ),
  (
    'a1b2c3d4-0018-4000-8000-000000000018',
    'ambulance',
    'Nightingale',
    'A-06',
    'available',
    2025,
    'Mercedes-Benz',
    'Sprinter 314 CDI',
    '{
      "engine_displacement": 2143,
      "horsepower": 143,
      "top_speed_kmh": 148,
      "fuel_type": "diesel",
      "tank_capacity_liters": 75,
      "patient_capacity": 2,
      "stretcher_count": 2,
      "life_support_level": "ALS",
      "oxygen_tank_liters": 60,
      "defibrillator": "Corpuls 3",
      "ventilator": "Hamilton T1",
      "suction_unit": true,
      "climate_controlled_cabin": true,
      "ultrasound_portable": true,
      "pediatric_kit": true
    }',
    40.3845,
    -3.6920,
    11
  ),

  -- --------------------------------------------------------
  -- Fire Trucks (F-03 through F-06) — 4 new, total 6
  -- --------------------------------------------------------
  (
    'a1b2c3d4-0019-4000-8000-000000000019',
    'fire_truck',
    'Inferno One',
    'F-03',
    'available',
    2022,
    'Scania',
    'P320 CB',
    '{
      "engine_displacement": 9300,
      "horsepower": 320,
      "top_speed_kmh": 100,
      "fuel_type": "diesel",
      "tank_capacity_liters": 200,
      "water_tank_liters": 5000,
      "foam_tank_liters": 500,
      "pump_capacity_lpm": 6000,
      "hose_length_meters": 800,
      "ladder_length_meters": 0,
      "crew_capacity": 6,
      "thermal_imaging_camera": true,
      "scba_units": 6,
      "compressed_air_foam": true,
      "ventilation_fan": true
    }',
    40.4345,
    -3.7248,
    8
  ),
  (
    'a1b2c3d4-0020-4000-8000-000000000020',
    'fire_truck',
    'Tower Rescue',
    'F-04',
    'available',
    2021,
    'Mercedes-Benz',
    'Atego 1530',
    '{
      "engine_displacement": 7698,
      "horsepower": 299,
      "top_speed_kmh": 95,
      "fuel_type": "diesel",
      "tank_capacity_liters": 180,
      "water_tank_liters": 2000,
      "foam_tank_liters": 150,
      "pump_capacity_lpm": 3500,
      "hose_length_meters": 500,
      "ladder_length_meters": 32,
      "crew_capacity": 4,
      "aerial_platform": true,
      "thermal_imaging_camera": true,
      "scba_units": 4,
      "rescue_winch": true,
      "hydraulic_cutting_tools": true
    }',
    40.4482,
    -3.7100,
    14
  ),
  (
    'a1b2c3d4-0021-4000-8000-000000000021',
    'fire_truck',
    'Phoenix Unit',
    'F-05',
    'maintenance',
    2020,
    'Renault',
    'D Wide 280',
    '{
      "engine_displacement": 7700,
      "horsepower": 280,
      "top_speed_kmh": 100,
      "fuel_type": "diesel",
      "tank_capacity_liters": 180,
      "water_tank_liters": 4000,
      "foam_tank_liters": 300,
      "pump_capacity_lpm": 4500,
      "hose_length_meters": 700,
      "ladder_length_meters": 0,
      "crew_capacity": 6,
      "thermal_imaging_camera": true,
      "scba_units": 6,
      "ventilation_fan": true,
      "gas_detector": true,
      "portable_lighting_mast": true
    }',
    40.4060,
    -3.7385,
    38
  ),
  (
    'a1b2c3d4-0022-4000-8000-000000000022',
    'fire_truck',
    'Blaze Runner',
    'F-06',
    'available',
    2024,
    'MAN',
    'TGM 18.340',
    '{
      "engine_displacement": 6871,
      "horsepower": 340,
      "top_speed_kmh": 105,
      "fuel_type": "diesel",
      "tank_capacity_liters": 200,
      "water_tank_liters": 3500,
      "foam_tank_liters": 250,
      "pump_capacity_lpm": 5000,
      "hose_length_meters": 650,
      "ladder_length_meters": 0,
      "crew_capacity": 6,
      "thermal_imaging_camera": true,
      "scba_units": 6,
      "compressed_air_foam": true,
      "ventilation_fan": true,
      "rescue_saw": true
    }',
    40.3880,
    -3.7460,
    5
  ),

  -- --------------------------------------------------------
  -- Civil Protection (CP-03 through CP-06) — 4 new, total 6
  -- --------------------------------------------------------
  (
    'a1b2c3d4-0023-4000-8000-000000000023',
    'civil_protection',
    'Sentinel',
    'CP-03',
    'available',
    2023,
    'Nissan',
    'Patrol Y62',
    '{
      "engine_displacement": 5552,
      "horsepower": 400,
      "top_speed_kmh": 190,
      "fuel_type": "gasoline",
      "tank_capacity_liters": 100,
      "four_wheel_drive": true,
      "wading_depth_mm": 700,
      "towing_capacity_kg": 3500,
      "crew_capacity": 7,
      "satellite_phone": true,
      "gps_mapping": true,
      "loudspeaker_system": true,
      "emergency_supplies_capacity_kg": 600,
      "searchlight": true
    }',
    40.4560,
    -3.6750,
    7
  ),
  (
    'a1b2c3d4-0024-4000-8000-000000000024',
    'civil_protection',
    'Vanguard',
    'CP-04',
    'available',
    2022,
    'Mitsubishi',
    'L200 Warrior',
    '{
      "engine_displacement": 2268,
      "horsepower": 150,
      "top_speed_kmh": 175,
      "fuel_type": "diesel",
      "tank_capacity_liters": 75,
      "four_wheel_drive": true,
      "wading_depth_mm": 600,
      "towing_capacity_kg": 3100,
      "crew_capacity": 5,
      "satellite_phone": true,
      "gps_mapping": true,
      "portable_generator": true,
      "chainsaw": true,
      "flood_lights": 2
    }',
    40.4015,
    -3.5985,
    10
  ),
  (
    'a1b2c3d4-0025-4000-8000-000000000025',
    'civil_protection',
    'Bastion',
    'CP-05',
    'in_service',
    2024,
    'Land Rover',
    'Defender 130',
    '{
      "engine_displacement": 2997,
      "horsepower": 300,
      "top_speed_kmh": 180,
      "fuel_type": "diesel",
      "tank_capacity_liters": 90,
      "four_wheel_drive": true,
      "wading_depth_mm": 900,
      "towing_capacity_kg": 3500,
      "crew_capacity": 8,
      "satellite_phone": true,
      "gps_mapping": true,
      "loudspeaker_system": true,
      "emergency_supplies_capacity_kg": 900,
      "water_purification_unit": true,
      "portable_shelter_kits": 4
    }',
    40.4220,
    -3.7560,
    16
  ),
  (
    'a1b2c3d4-0026-4000-8000-000000000026',
    'civil_protection',
    'Warden',
    'CP-06',
    'available',
    2021,
    'Toyota',
    'Hilux Invincible',
    '{
      "engine_displacement": 2755,
      "horsepower": 204,
      "top_speed_kmh": 170,
      "fuel_type": "diesel",
      "tank_capacity_liters": 80,
      "four_wheel_drive": true,
      "wading_depth_mm": 700,
      "towing_capacity_kg": 3200,
      "crew_capacity": 5,
      "satellite_phone": true,
      "gps_mapping": true,
      "portable_generator": true,
      "rescue_tools": true,
      "flood_lights": 4,
      "inflatable_boat": true
    }',
    40.3810,
    -3.7265,
    12
  ),

  -- --------------------------------------------------------
  -- Hybrid / Specialized (H-03 through H-06) — 4 new, total 6
  -- --------------------------------------------------------
  (
    'a1b2c3d4-0027-4000-8000-000000000027',
    'hybrid',
    'Titan Response',
    'H-03',
    'available',
    2023,
    'MAN',
    'TGS 18.510',
    '{
      "engine_displacement": 12419,
      "horsepower": 510,
      "top_speed_kmh": 90,
      "fuel_type": "diesel",
      "tank_capacity_liters": 300,
      "four_wheel_drive": true,
      "crane_capacity_kg": 8000,
      "crew_capacity": 3,
      "modular_rear_body": true,
      "winch_capacity_kg": 12000,
      "roles": ["heavy_rescue", "logistics", "crane_ops"],
      "hydraulic_tools": true,
      "towing_capacity_kg": 18000,
      "pto_power_kw": 100,
      "outriggers": true
    }',
    40.4365,
    -3.6560,
    13
  ),
  (
    'a1b2c3d4-0028-4000-8000-000000000028',
    'hybrid',
    'Hawk Eye',
    'H-04',
    'available',
    2024,
    'Iveco',
    'Daily 70C18',
    '{
      "engine_displacement": 2998,
      "horsepower": 180,
      "top_speed_kmh": 130,
      "fuel_type": "diesel",
      "tank_capacity_liters": 100,
      "crew_capacity": 4,
      "roles": ["surveillance", "communications", "reconnaissance"],
      "drone_count": 3,
      "drone_models": ["DJI Matrice 350 RTK", "DJI Mavic 3 Enterprise", "Autel EVO II"],
      "satellite_uplink": true,
      "radio_channels": 8,
      "video_screens": 3,
      "thermal_camera_mast": true,
      "mast_height_meters": 12,
      "generator_kw": 8
    }',
    40.4140,
    -3.6830,
    4
  ),
  (
    'a1b2c3d4-0029-4000-8000-000000000029',
    'hybrid',
    'Hazmat Shield',
    'H-05',
    'available',
    2022,
    'Renault',
    'D Wide 320',
    '{
      "engine_displacement": 7700,
      "horsepower": 320,
      "top_speed_kmh": 100,
      "fuel_type": "diesel",
      "tank_capacity_liters": 180,
      "crew_capacity": 4,
      "roles": ["hazmat", "decontamination", "chemical_rescue"],
      "hazmat_decon_shower": true,
      "chemical_detection_suite": true,
      "gas_tight_suits": 6,
      "containment_drums": 12,
      "absorbent_booms_meters": 100,
      "air_monitoring_stations": 4,
      "decon_water_tank_liters": 2000,
      "neutralizing_agents": true
    }',
    40.4480,
    -3.7320,
    10
  ),
  (
    'a1b2c3d4-0030-4000-8000-000000000030',
    'hybrid',
    'Atlas Logistics',
    'H-06',
    'available',
    2025,
    'Mercedes-Benz',
    'Arocs 1833',
    '{
      "engine_displacement": 7698,
      "horsepower": 330,
      "top_speed_kmh": 100,
      "fuel_type": "diesel",
      "tank_capacity_liters": 250,
      "four_wheel_drive": true,
      "crew_capacity": 3,
      "roles": ["logistics", "field_hospital", "mass_casualty"],
      "modular_rear_body": true,
      "expandable_shelter": true,
      "shelter_area_sqm": 40,
      "medical_beds": 8,
      "generator_kw": 30,
      "water_tank_liters": 1000,
      "climate_control": true,
      "towing_capacity_kg": 15000
    }',
    40.4010,
    -3.7580,
    2
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- VEHICLE EQUIPMENT (3-4 items per new vehicle)
-- ============================================================

INSERT INTO vehicle_equipment (vehicle_id, equipment_name, category, status, last_checked) VALUES

  -- P-04 Delta Squad
  ('a1b2c3d4-0013-4000-8000-000000000013', 'TETRA Radio', 'communications', 'operational', now() - interval '3 hours'),
  ('a1b2c3d4-0013-4000-8000-000000000013', 'Dash Camera 4K', 'surveillance', 'operational', now() - interval '3 hours'),
  ('a1b2c3d4-0013-4000-8000-000000000013', 'Speed Radar Gun', 'enforcement', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0013-4000-8000-000000000013', 'Ballistic Vest x2', 'protective', 'operational', now() - interval '12 hours'),

  -- P-05 Echo Patrol
  ('a1b2c3d4-0014-4000-8000-000000000014', 'TETRA Radio', 'communications', 'operational', now() - interval '1 hour'),
  ('a1b2c3d4-0014-4000-8000-000000000014', 'Body Camera x2', 'surveillance', 'operational', now() - interval '2 hours'),
  ('a1b2c3d4-0014-4000-8000-000000000014', 'Night Vision Scope', 'surveillance', 'operational', now() - interval '8 hours'),
  ('a1b2c3d4-0014-4000-8000-000000000014', 'License Plate Reader', 'surveillance', 'needs_repair', now() - interval '36 hours'),

  -- P-06 Foxtrot Watch
  ('a1b2c3d4-0015-4000-8000-000000000015', 'TETRA Radio', 'communications', 'operational', now() - interval '2 hours'),
  ('a1b2c3d4-0015-4000-8000-000000000015', 'Dash Camera 4K', 'surveillance', 'operational', now() - interval '2 hours'),
  ('a1b2c3d4-0015-4000-8000-000000000015', 'Body Camera x3', 'surveillance', 'operational', now() - interval '4 hours'),

  -- A-04 Guardian Angel
  ('a1b2c3d4-0016-4000-8000-000000000016', 'Philips HeartStart FR3 Defibrillator', 'medical', 'operational', now() - interval '2 hours'),
  ('a1b2c3d4-0016-4000-8000-000000000016', 'Oxygen Supply System (45L)', 'medical', 'operational', now() - interval '4 hours'),
  ('a1b2c3d4-0016-4000-8000-000000000016', 'Stretcher - Manual', 'transport', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0016-4000-8000-000000000016', 'Stair Chair', 'transport', 'operational', now() - interval '8 hours'),

  -- A-05 Swift Medic
  ('a1b2c3d4-0017-4000-8000-000000000017', 'Zoll AED 3 Defibrillator', 'medical', 'operational', now() - interval '1 hour'),
  ('a1b2c3d4-0017-4000-8000-000000000017', 'Dräger Oxylog 3000 Ventilator', 'medical', 'operational', now() - interval '3 hours'),
  ('a1b2c3d4-0017-4000-8000-000000000017', 'Oxygen Supply System (50L)', 'medical', 'operational', now() - interval '2 hours'),
  ('a1b2c3d4-0017-4000-8000-000000000017', 'Blood Analyzer Portable', 'medical', 'needs_repair', now() - interval '48 hours'),

  -- A-06 Nightingale
  ('a1b2c3d4-0018-4000-8000-000000000018', 'Corpuls 3 Defibrillator', 'medical', 'operational', now() - interval '2 hours'),
  ('a1b2c3d4-0018-4000-8000-000000000018', 'Hamilton T1 Ventilator', 'medical', 'operational', now() - interval '4 hours'),
  ('a1b2c3d4-0018-4000-8000-000000000018', 'Portable Ultrasound', 'medical', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0018-4000-8000-000000000018', 'Stretcher - Power Cot x2', 'transport', 'operational', now() - interval '5 hours'),

  -- F-03 Inferno One
  ('a1b2c3d4-0019-4000-8000-000000000019', 'Thermal Imaging Camera', 'detection', 'operational', now() - interval '5 hours'),
  ('a1b2c3d4-0019-4000-8000-000000000019', 'SCBA Breathing Apparatus x6', 'protective', 'operational', now() - interval '8 hours'),
  ('a1b2c3d4-0019-4000-8000-000000000019', 'CAFS Foam System', 'suppression', 'operational', now() - interval '10 hours'),
  ('a1b2c3d4-0019-4000-8000-000000000019', 'Fire Hose 800m', 'suppression', 'operational', now() - interval '12 hours'),

  -- F-04 Tower Rescue
  ('a1b2c3d4-0020-4000-8000-000000000020', '32m Aerial Ladder', 'access', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0020-4000-8000-000000000020', 'Thermal Imaging Camera', 'detection', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0020-4000-8000-000000000020', 'SCBA Breathing Apparatus x4', 'protective', 'operational', now() - interval '10 hours'),
  ('a1b2c3d4-0020-4000-8000-000000000020', 'Hydraulic Cutting Tools', 'rescue', 'operational', now() - interval '14 hours'),

  -- F-05 Phoenix Unit
  ('a1b2c3d4-0021-4000-8000-000000000021', 'Thermal Imaging Camera', 'detection', 'needs_repair', now() - interval '72 hours'),
  ('a1b2c3d4-0021-4000-8000-000000000021', 'SCBA Breathing Apparatus x6', 'protective', 'operational', now() - interval '24 hours'),
  ('a1b2c3d4-0021-4000-8000-000000000021', 'Multi-Gas Detector', 'detection', 'operational', now() - interval '24 hours'),
  ('a1b2c3d4-0021-4000-8000-000000000021', 'Portable Lighting Mast', 'lighting', 'operational', now() - interval '36 hours'),

  -- F-06 Blaze Runner
  ('a1b2c3d4-0022-4000-8000-000000000022', 'Thermal Imaging Camera', 'detection', 'operational', now() - interval '4 hours'),
  ('a1b2c3d4-0022-4000-8000-000000000022', 'SCBA Breathing Apparatus x6', 'protective', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0022-4000-8000-000000000022', 'CAFS Foam System', 'suppression', 'operational', now() - interval '8 hours'),
  ('a1b2c3d4-0022-4000-8000-000000000022', 'Rescue Saw (Partner K12)', 'rescue', 'operational', now() - interval '10 hours'),

  -- CP-03 Sentinel
  ('a1b2c3d4-0023-4000-8000-000000000023', 'Satellite Phone Iridium', 'communications', 'operational', now() - interval '4 hours'),
  ('a1b2c3d4-0023-4000-8000-000000000023', 'Loudspeaker PA System', 'communications', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0023-4000-8000-000000000023', 'Searchlight 5000W', 'lighting', 'operational', now() - interval '10 hours'),
  ('a1b2c3d4-0023-4000-8000-000000000023', 'Emergency Supply Kit (600kg)', 'supplies', 'operational', now() - interval '24 hours'),

  -- CP-04 Vanguard
  ('a1b2c3d4-0024-4000-8000-000000000024', 'Satellite Phone Iridium', 'communications', 'operational', now() - interval '5 hours'),
  ('a1b2c3d4-0024-4000-8000-000000000024', 'Portable Generator 3kW', 'power', 'operational', now() - interval '12 hours'),
  ('a1b2c3d4-0024-4000-8000-000000000024', 'Chainsaw Husqvarna 572 XP', 'tools', 'operational', now() - interval '18 hours'),

  -- CP-05 Bastion
  ('a1b2c3d4-0025-4000-8000-000000000025', 'Satellite Phone Iridium', 'communications', 'operational', now() - interval '2 hours'),
  ('a1b2c3d4-0025-4000-8000-000000000025', 'Loudspeaker PA System', 'communications', 'operational', now() - interval '4 hours'),
  ('a1b2c3d4-0025-4000-8000-000000000025', 'Water Purification Unit', 'supplies', 'operational', now() - interval '8 hours'),
  ('a1b2c3d4-0025-4000-8000-000000000025', 'Portable Shelter Kit x4', 'supplies', 'needs_repair', now() - interval '60 hours'),

  -- CP-06 Warden
  ('a1b2c3d4-0026-4000-8000-000000000026', 'Satellite Phone Iridium', 'communications', 'operational', now() - interval '7 hours'),
  ('a1b2c3d4-0026-4000-8000-000000000026', 'Portable Generator 5kW', 'power', 'operational', now() - interval '14 hours'),
  ('a1b2c3d4-0026-4000-8000-000000000026', 'Flood Lights x4', 'lighting', 'operational', now() - interval '9 hours'),
  ('a1b2c3d4-0026-4000-8000-000000000026', 'Inflatable Rescue Boat', 'rescue', 'operational', now() - interval '30 hours'),

  -- H-03 Titan Response
  ('a1b2c3d4-0027-4000-8000-000000000027', 'Crane Assembly (8T)', 'heavy_equipment', 'operational', now() - interval '10 hours'),
  ('a1b2c3d4-0027-4000-8000-000000000027', '12T Winch System', 'heavy_equipment', 'operational', now() - interval '10 hours'),
  ('a1b2c3d4-0027-4000-8000-000000000027', 'Hydraulic Rescue Tool Set', 'rescue', 'operational', now() - interval '18 hours'),
  ('a1b2c3d4-0027-4000-8000-000000000027', 'Outrigger Stabilizers', 'heavy_equipment', 'operational', now() - interval '12 hours'),

  -- H-04 Hawk Eye
  ('a1b2c3d4-0028-4000-8000-000000000028', 'DJI Matrice 350 RTK Drone', 'surveillance', 'operational', now() - interval '4 hours'),
  ('a1b2c3d4-0028-4000-8000-000000000028', 'DJI Mavic 3 Enterprise Drone', 'surveillance', 'operational', now() - interval '4 hours'),
  ('a1b2c3d4-0028-4000-8000-000000000028', 'Thermal Camera Mast (12m)', 'surveillance', 'operational', now() - interval '8 hours'),
  ('a1b2c3d4-0028-4000-8000-000000000028', 'Satellite Uplink Terminal', 'communications', 'operational', now() - interval '3 hours'),

  -- H-05 Hazmat Shield
  ('a1b2c3d4-0029-4000-8000-000000000029', 'Chemical Detection Suite', 'detection', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0029-4000-8000-000000000029', 'Gas-Tight Suit x6', 'protective', 'operational', now() - interval '12 hours'),
  ('a1b2c3d4-0029-4000-8000-000000000029', 'Decontamination Shower Unit', 'hazmat', 'operational', now() - interval '10 hours'),
  ('a1b2c3d4-0029-4000-8000-000000000029', 'Air Monitoring Station x4', 'detection', 'needs_repair', now() - interval '48 hours'),

  -- H-06 Atlas Logistics
  ('a1b2c3d4-0030-4000-8000-000000000030', 'Expandable Field Shelter (40sqm)', 'logistics', 'operational', now() - interval '8 hours'),
  ('a1b2c3d4-0030-4000-8000-000000000030', 'Generator 30kW', 'power', 'operational', now() - interval '12 hours'),
  ('a1b2c3d4-0030-4000-8000-000000000030', 'Medical Beds x8', 'medical', 'operational', now() - interval '16 hours'),
  ('a1b2c3d4-0030-4000-8000-000000000030', 'Climate Control System', 'logistics', 'operational', now() - interval '8 hours');

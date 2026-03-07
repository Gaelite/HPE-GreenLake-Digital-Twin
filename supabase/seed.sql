-- ============================================================
-- Digital Twin - Emergency Vehicles POC — Seed Data
-- ============================================================
-- Run after 00001_initial_schema.sql to populate demo data
-- All positions are realistic Madrid, Spain coordinates
-- ============================================================

-- ============================================================
-- VEHICLES (12 vehicles across 5 types)
-- ============================================================

INSERT INTO vehicles (id, type, name, plate_number, status, year, make, model, specifications, current_latitude, current_longitude, risk_score)
VALUES
  -- Police vehicles
  (
    'a1b2c3d4-0001-4000-8000-000000000001',
    'police',
    'Alpha Patrol',
    'P-01',
    'available',
    2023,
    'BMW',
    '5 Series Touring',
    '{
      "engine_displacement": 2998,
      "horsepower": 340,
      "top_speed_kmh": 250,
      "fuel_type": "diesel",
      "tank_capacity_liters": 68,
      "armor_rating": "NIJ Level IIIA",
      "radio_system": "TETRA Digital",
      "sirens": true,
      "dash_cam": true,
      "license_plate_reader": true,
      "lightbar": "LED Federal Signal",
      "pursuit_rated": true
    }',
    40.4168,
    -3.7038,
    12
  ),
  (
    'a1b2c3d4-0002-4000-8000-000000000002',
    'police',
    'Bravo Unit',
    'P-02',
    'in_service',
    2022,
    'Seat',
    'Leon Cupra',
    '{
      "engine_displacement": 1984,
      "horsepower": 300,
      "top_speed_kmh": 230,
      "fuel_type": "gasoline",
      "tank_capacity_liters": 55,
      "radio_system": "TETRA Digital",
      "sirens": true,
      "dash_cam": true,
      "license_plate_reader": true,
      "lightbar": "LED Whelen",
      "pursuit_rated": true,
      "speed_radar": true
    }',
    40.4253,
    -3.6883,
    28
  ),
  (
    'a1b2c3d4-0003-4000-8000-000000000003',
    'police',
    'Charlie Watch',
    'P-03',
    'available',
    2024,
    'Hyundai',
    'Tucson',
    '{
      "engine_displacement": 1598,
      "horsepower": 230,
      "top_speed_kmh": 210,
      "fuel_type": "hybrid",
      "tank_capacity_liters": 52,
      "battery_capacity_kwh": 1.49,
      "radio_system": "TETRA Digital",
      "sirens": true,
      "dash_cam": true,
      "body_cameras": 2,
      "lightbar": "LED Code 3",
      "pursuit_rated": false
    }',
    40.4376,
    -3.7145,
    8
  ),

  -- Ambulances
  (
    'a1b2c3d4-0004-4000-8000-000000000004',
    'ambulance',
    'Medic One',
    'A-01',
    'available',
    2023,
    'Mercedes-Benz',
    'Sprinter 319 CDI',
    '{
      "engine_displacement": 2987,
      "horsepower": 190,
      "top_speed_kmh": 160,
      "fuel_type": "diesel",
      "tank_capacity_liters": 75,
      "patient_capacity": 2,
      "stretcher_count": 1,
      "life_support_level": "ALS",
      "oxygen_tank_liters": 50,
      "defibrillator": "Zoll X Series",
      "ventilator": "Hamilton T1",
      "suction_unit": true,
      "climate_controlled_cabin": true
    }',
    40.4092,
    -3.6935,
    15
  ),
  (
    'a1b2c3d4-0005-4000-8000-000000000005',
    'ambulance',
    'Rapid Response',
    'A-02',
    'in_service',
    2024,
    'Volkswagen',
    'Crafter TDI',
    '{
      "engine_displacement": 1968,
      "horsepower": 177,
      "top_speed_kmh": 155,
      "fuel_type": "diesel",
      "tank_capacity_liters": 75,
      "patient_capacity": 1,
      "stretcher_count": 1,
      "life_support_level": "BLS",
      "oxygen_tank_liters": 40,
      "defibrillator": "Philips HeartStart",
      "suction_unit": true,
      "climate_controlled_cabin": true
    }',
    40.4315,
    -3.6762,
    22
  ),
  (
    'a1b2c3d4-0006-4000-8000-000000000006',
    'ambulance',
    'Life Support',
    'A-03',
    'available',
    2022,
    'Renault',
    'Master dCi',
    '{
      "engine_displacement": 2299,
      "horsepower": 165,
      "top_speed_kmh": 150,
      "fuel_type": "diesel",
      "tank_capacity_liters": 80,
      "patient_capacity": 2,
      "stretcher_count": 2,
      "life_support_level": "ALS",
      "oxygen_tank_liters": 60,
      "defibrillator": "Zoll R Series",
      "ventilator": "Weinmann Medumat",
      "incubator": true,
      "suction_unit": true,
      "climate_controlled_cabin": true
    }',
    40.3985,
    -3.7210,
    18
  ),

  -- Fire Trucks
  (
    'a1b2c3d4-0007-4000-8000-000000000007',
    'fire_truck',
    'Engine 7',
    'F-01',
    'available',
    2021,
    'Iveco',
    'Eurocargo ML160',
    '{
      "engine_displacement": 6728,
      "horsepower": 300,
      "top_speed_kmh": 110,
      "fuel_type": "diesel",
      "tank_capacity_liters": 150,
      "water_tank_liters": 3000,
      "foam_tank_liters": 200,
      "pump_capacity_lpm": 4000,
      "hose_length_meters": 600,
      "ladder_length_meters": 0,
      "crew_capacity": 6,
      "thermal_imaging_camera": true,
      "scba_units": 6,
      "ventilation_fan": true
    }',
    40.4225,
    -3.7180,
    10
  ),
  (
    'a1b2c3d4-0008-4000-8000-000000000008',
    'fire_truck',
    'Ladder 3',
    'F-02',
    'maintenance',
    2019,
    'MAN',
    'TGM 18.290',
    '{
      "engine_displacement": 6871,
      "horsepower": 290,
      "top_speed_kmh": 95,
      "fuel_type": "diesel",
      "tank_capacity_liters": 200,
      "water_tank_liters": 1500,
      "foam_tank_liters": 100,
      "pump_capacity_lpm": 2500,
      "hose_length_meters": 400,
      "ladder_length_meters": 30,
      "crew_capacity": 4,
      "aerial_platform": true,
      "thermal_imaging_camera": true,
      "scba_units": 4,
      "rescue_winch": true
    }',
    40.4295,
    -3.7065,
    45
  ),

  -- Civil Protection
  (
    'a1b2c3d4-0009-4000-8000-000000000009',
    'civil_protection',
    'Shield Unit',
    'CP-01',
    'available',
    2023,
    'Toyota',
    'Land Cruiser 300',
    '{
      "engine_displacement": 3346,
      "horsepower": 309,
      "top_speed_kmh": 170,
      "fuel_type": "diesel",
      "tank_capacity_liters": 110,
      "four_wheel_drive": true,
      "wading_depth_mm": 700,
      "towing_capacity_kg": 3500,
      "crew_capacity": 5,
      "satellite_phone": true,
      "gps_mapping": true,
      "loudspeaker_system": true,
      "emergency_supplies_capacity_kg": 800,
      "water_purification_unit": false
    }',
    40.4450,
    -3.6900,
    5
  ),
  (
    'a1b2c3d4-0010-4000-8000-000000000010',
    'civil_protection',
    'Rescue One',
    'CP-02',
    'available',
    2022,
    'Ford',
    'Ranger Raptor',
    '{
      "engine_displacement": 1996,
      "horsepower": 213,
      "top_speed_kmh": 180,
      "fuel_type": "diesel",
      "tank_capacity_liters": 80,
      "four_wheel_drive": true,
      "wading_depth_mm": 850,
      "towing_capacity_kg": 2500,
      "crew_capacity": 5,
      "satellite_phone": true,
      "gps_mapping": true,
      "portable_generator": true,
      "rescue_tools": true,
      "flood_lights": 4
    }',
    40.3890,
    -3.7050,
    14
  ),

  -- Hybrid / Specialized
  (
    'a1b2c3d4-0011-4000-8000-000000000011',
    'hybrid',
    'Multi-Role Alpha',
    'H-01',
    'in_service',
    2024,
    'Mercedes-Benz',
    'Unimog U5023',
    '{
      "engine_displacement": 5132,
      "horsepower": 231,
      "top_speed_kmh": 90,
      "fuel_type": "diesel",
      "tank_capacity_liters": 160,
      "four_wheel_drive": true,
      "wading_depth_mm": 1200,
      "crane_capacity_kg": 5000,
      "crew_capacity": 3,
      "modular_rear_body": true,
      "winch_capacity_kg": 8000,
      "roles": ["rescue", "logistics", "hazmat"],
      "hazmat_decon_kit": true,
      "towing_capacity_kg": 12000,
      "pto_power_kw": 75
    }',
    40.4110,
    -3.7320,
    35
  ),
  (
    'a1b2c3d4-0012-4000-8000-000000000012',
    'hybrid',
    'Command Unit',
    'H-02',
    'available',
    2023,
    'Mercedes-Benz',
    'Sprinter 516 CDI',
    '{
      "engine_displacement": 2143,
      "horsepower": 163,
      "top_speed_kmh": 140,
      "fuel_type": "diesel",
      "tank_capacity_liters": 75,
      "crew_capacity": 6,
      "roles": ["command", "communications", "coordination"],
      "satellite_uplink": true,
      "radio_channels": 16,
      "video_wall_screens": 4,
      "drone_launch_pad": true,
      "generator_kw": 12,
      "workstations": 4,
      "secure_comms": true,
      "gis_mapping_station": true
    }',
    40.4198,
    -3.6980,
    7
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- VEHICLE EQUIPMENT (3-5 per vehicle)
-- ============================================================

INSERT INTO vehicle_equipment (vehicle_id, equipment_name, category, status, last_checked) VALUES
  -- P-01 Alpha Patrol
  ('a1b2c3d4-0001-4000-8000-000000000001', 'TETRA Radio', 'communications', 'operational', now() - interval '2 hours'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Dash Camera HD', 'surveillance', 'operational', now() - interval '2 hours'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'License Plate Reader', 'surveillance', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Ballistic Vest x2', 'protective', 'operational', now() - interval '12 hours'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'LED Lightbar Federal Signal', 'lighting', 'operational', now() - interval '2 hours'),

  -- P-02 Bravo Unit
  ('a1b2c3d4-0002-4000-8000-000000000002', 'TETRA Radio', 'communications', 'operational', now() - interval '1 hour'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Speed Radar Gun', 'enforcement', 'operational', now() - interval '4 hours'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Dash Camera HD', 'surveillance', 'operational', now() - interval '1 hour'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Breathalyzer Kit', 'enforcement', 'needs_repair', now() - interval '48 hours'),

  -- P-03 Charlie Watch
  ('a1b2c3d4-0003-4000-8000-000000000003', 'TETRA Radio', 'communications', 'operational', now() - interval '3 hours'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Body Camera x2', 'surveillance', 'operational', now() - interval '3 hours'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'First Aid Kit', 'medical', 'operational', now() - interval '24 hours'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Traffic Cones x6', 'traffic', 'operational', now() - interval '12 hours'),

  -- A-01 Medic One
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Zoll X Series Defibrillator', 'medical', 'operational', now() - interval '1 hour'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Hamilton T1 Ventilator', 'medical', 'operational', now() - interval '4 hours'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Oxygen Supply System (50L)', 'medical', 'operational', now() - interval '2 hours'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Stretcher - Power Cot', 'transport', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'IV Infusion Pump', 'medical', 'operational', now() - interval '8 hours'),

  -- A-02 Rapid Response
  ('a1b2c3d4-0005-4000-8000-000000000005', 'Philips HeartStart Defibrillator', 'medical', 'operational', now() - interval '2 hours'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'Oxygen Supply System (40L)', 'medical', 'operational', now() - interval '3 hours'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'Stretcher - Manual', 'transport', 'operational', now() - interval '5 hours'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'Spinal Board', 'transport', 'needs_repair', now() - interval '36 hours'),

  -- A-03 Life Support
  ('a1b2c3d4-0006-4000-8000-000000000006', 'Zoll R Series Defibrillator', 'medical', 'operational', now() - interval '3 hours'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'Weinmann Medumat Ventilator', 'medical', 'operational', now() - interval '3 hours'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'Neonatal Incubator', 'medical', 'operational', now() - interval '12 hours'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'Oxygen Supply System (60L)', 'medical', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'Stretcher - Power Cot x2', 'transport', 'operational', now() - interval '8 hours'),

  -- F-01 Engine 7
  ('a1b2c3d4-0007-4000-8000-000000000007', 'Thermal Imaging Camera', 'detection', 'operational', now() - interval '4 hours'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'SCBA Breathing Apparatus x6', 'protective', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'Hydraulic Rescue Tools (Jaws)', 'rescue', 'operational', now() - interval '12 hours'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'Fire Hose 600m', 'suppression', 'operational', now() - interval '8 hours'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'Positive Pressure Ventilator', 'ventilation', 'operational', now() - interval '10 hours'),

  -- F-02 Ladder 3
  ('a1b2c3d4-0008-4000-8000-000000000008', '30m Aerial Ladder', 'access', 'needs_repair', now() - interval '72 hours'),
  ('a1b2c3d4-0008-4000-8000-000000000008', 'Thermal Imaging Camera', 'detection', 'operational', now() - interval '24 hours'),
  ('a1b2c3d4-0008-4000-8000-000000000008', 'SCBA Breathing Apparatus x4', 'protective', 'operational', now() - interval '24 hours'),
  ('a1b2c3d4-0008-4000-8000-000000000008', 'Rescue Winch System', 'rescue', 'needs_repair', now() - interval '72 hours'),

  -- CP-01 Shield Unit
  ('a1b2c3d4-0009-4000-8000-000000000009', 'Satellite Phone Iridium', 'communications', 'operational', now() - interval '5 hours'),
  ('a1b2c3d4-0009-4000-8000-000000000009', 'Loudspeaker PA System', 'communications', 'operational', now() - interval '8 hours'),
  ('a1b2c3d4-0009-4000-8000-000000000009', 'Emergency Supply Kit (800kg)', 'supplies', 'operational', now() - interval '24 hours'),
  ('a1b2c3d4-0009-4000-8000-000000000009', 'GPS Mapping Tablet', 'navigation', 'operational', now() - interval '2 hours'),

  -- CP-02 Rescue One
  ('a1b2c3d4-0010-4000-8000-000000000010', 'Satellite Phone Iridium', 'communications', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0010-4000-8000-000000000010', 'Portable Generator 5kW', 'power', 'operational', now() - interval '12 hours'),
  ('a1b2c3d4-0010-4000-8000-000000000010', 'Hydraulic Rescue Tool Set', 'rescue', 'operational', now() - interval '24 hours'),
  ('a1b2c3d4-0010-4000-8000-000000000010', 'Flood Lights x4', 'lighting', 'operational', now() - interval '8 hours'),
  ('a1b2c3d4-0010-4000-8000-000000000010', 'Inflatable Rescue Boat', 'rescue', 'operational', now() - interval '36 hours'),

  -- H-01 Multi-Role Alpha
  ('a1b2c3d4-0011-4000-8000-000000000011', 'Crane Assembly (5T)', 'heavy_equipment', 'operational', now() - interval '12 hours'),
  ('a1b2c3d4-0011-4000-8000-000000000011', '8T Winch System', 'heavy_equipment', 'operational', now() - interval '12 hours'),
  ('a1b2c3d4-0011-4000-8000-000000000011', 'HazMat Decontamination Kit', 'hazmat', 'operational', now() - interval '48 hours'),
  ('a1b2c3d4-0011-4000-8000-000000000011', 'Modular Cargo Platform', 'logistics', 'operational', now() - interval '24 hours'),

  -- H-02 Command Unit
  ('a1b2c3d4-0012-4000-8000-000000000012', 'Satellite Uplink Terminal', 'communications', 'operational', now() - interval '3 hours'),
  ('a1b2c3d4-0012-4000-8000-000000000012', 'Multi-Channel Radio (16ch)', 'communications', 'operational', now() - interval '3 hours'),
  ('a1b2c3d4-0012-4000-8000-000000000012', 'Video Wall (4 screens)', 'command', 'operational', now() - interval '6 hours'),
  ('a1b2c3d4-0012-4000-8000-000000000012', 'Drone DJI Matrice 300', 'surveillance', 'operational', now() - interval '8 hours'),
  ('a1b2c3d4-0012-4000-8000-000000000012', 'GIS Mapping Workstation', 'command', 'operational', now() - interval '6 hours');


-- ============================================================
-- TELEMETRY READINGS (5-10 per vehicle, recent timestamps)
-- ============================================================

-- Helper: We generate readings at various recent timestamps
-- Vehicle P-01 Alpha Patrol (available, parked)
INSERT INTO telemetry_readings (vehicle_id, metric_type, value, unit, latitude, longitude, timestamp) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'speed', 0, 'km/h', 40.4168, -3.7038, now() - interval '5 minutes'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'engine_temp', 45, 'celsius', 40.4168, -3.7038, now() - interval '5 minutes'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'fuel_level', 82, 'percent', 40.4168, -3.7038, now() - interval '5 minutes'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'tire_pressure', 33, 'psi', 40.4168, -3.7038, now() - interval '5 minutes'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'battery_voltage', 12.6, 'volts', 40.4168, -3.7038, now() - interval '5 minutes'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'odometer', 34521, 'km', 40.4168, -3.7038, now() - interval '5 minutes'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'speed', 0, 'km/h', 40.4168, -3.7038, now() - interval '15 minutes'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'engine_temp', 44, 'celsius', 40.4168, -3.7038, now() - interval '15 minutes'),

  -- Vehicle P-02 Bravo Unit (in_service, driving)
  ('a1b2c3d4-0002-4000-8000-000000000002', 'speed', 67, 'km/h', 40.4253, -3.6883, now() - interval '2 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'engine_temp', 91, 'celsius', 40.4253, -3.6883, now() - interval '2 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'fuel_level', 54, 'percent', 40.4253, -3.6883, now() - interval '2 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'tire_pressure', 32, 'psi', 40.4253, -3.6883, now() - interval '2 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'rpm', 3200, 'rpm', 40.4253, -3.6883, now() - interval '2 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'battery_voltage', 14.1, 'volts', 40.4253, -3.6883, now() - interval '2 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'speed', 45, 'km/h', 40.4240, -3.6900, now() - interval '12 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'engine_temp', 89, 'celsius', 40.4240, -3.6900, now() - interval '12 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'speed', 82, 'km/h', 40.4260, -3.6870, now() - interval '7 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'engine_temp', 92, 'celsius', 40.4260, -3.6870, now() - interval '7 minutes'),

  -- Vehicle P-03 Charlie Watch (available)
  ('a1b2c3d4-0003-4000-8000-000000000003', 'speed', 0, 'km/h', 40.4376, -3.7145, now() - interval '8 minutes'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'engine_temp', 42, 'celsius', 40.4376, -3.7145, now() - interval '8 minutes'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'fuel_level', 91, 'percent', 40.4376, -3.7145, now() - interval '8 minutes'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'tire_pressure', 34, 'psi', 40.4376, -3.7145, now() - interval '8 minutes'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'battery_voltage', 12.7, 'volts', 40.4376, -3.7145, now() - interval '8 minutes'),

  -- Vehicle A-01 Medic One (available, recently returned)
  ('a1b2c3d4-0004-4000-8000-000000000004', 'speed', 0, 'km/h', 40.4092, -3.6935, now() - interval '3 minutes'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'engine_temp', 68, 'celsius', 40.4092, -3.6935, now() - interval '3 minutes'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'fuel_level', 65, 'percent', 40.4092, -3.6935, now() - interval '3 minutes'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'tire_pressure', 35, 'psi', 40.4092, -3.6935, now() - interval '3 minutes'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'battery_voltage', 12.4, 'volts', 40.4092, -3.6935, now() - interval '3 minutes'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'odometer', 52789, 'km', 40.4092, -3.6935, now() - interval '3 minutes'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'speed', 38, 'km/h', 40.4080, -3.6950, now() - interval '20 minutes'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'engine_temp', 88, 'celsius', 40.4080, -3.6950, now() - interval '20 minutes'),

  -- Vehicle A-02 Rapid Response (in_service, driving)
  ('a1b2c3d4-0005-4000-8000-000000000005', 'speed', 95, 'km/h', 40.4315, -3.6762, now() - interval '1 minute'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'engine_temp', 94, 'celsius', 40.4315, -3.6762, now() - interval '1 minute'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'fuel_level', 41, 'percent', 40.4315, -3.6762, now() - interval '1 minute'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'tire_pressure', 31, 'psi', 40.4315, -3.6762, now() - interval '1 minute'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'rpm', 4100, 'rpm', 40.4315, -3.6762, now() - interval '1 minute'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'speed', 110, 'km/h', 40.4300, -3.6780, now() - interval '6 minutes'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'engine_temp', 96, 'celsius', 40.4300, -3.6780, now() - interval '6 minutes'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'speed', 55, 'km/h', 40.4290, -3.6800, now() - interval '11 minutes'),

  -- Vehicle A-03 Life Support (available)
  ('a1b2c3d4-0006-4000-8000-000000000006', 'speed', 0, 'km/h', 40.3985, -3.7210, now() - interval '10 minutes'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'engine_temp', 40, 'celsius', 40.3985, -3.7210, now() - interval '10 minutes'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'fuel_level', 73, 'percent', 40.3985, -3.7210, now() - interval '10 minutes'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'tire_pressure', 33, 'psi', 40.3985, -3.7210, now() - interval '10 minutes'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'battery_voltage', 12.5, 'volts', 40.3985, -3.7210, now() - interval '10 minutes'),

  -- Vehicle F-01 Engine 7 (available)
  ('a1b2c3d4-0007-4000-8000-000000000007', 'speed', 0, 'km/h', 40.4225, -3.7180, now() - interval '4 minutes'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'engine_temp', 52, 'celsius', 40.4225, -3.7180, now() - interval '4 minutes'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'fuel_level', 88, 'percent', 40.4225, -3.7180, now() - interval '4 minutes'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'tire_pressure', 36, 'psi', 40.4225, -3.7180, now() - interval '4 minutes'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'battery_voltage', 12.8, 'volts', 40.4225, -3.7180, now() - interval '4 minutes'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'odometer', 78234, 'km', 40.4225, -3.7180, now() - interval '4 minutes'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'oil_pressure', 45, 'psi', 40.4225, -3.7180, now() - interval '4 minutes'),

  -- Vehicle F-02 Ladder 3 (maintenance)
  ('a1b2c3d4-0008-4000-8000-000000000008', 'speed', 0, 'km/h', 40.4295, -3.7065, now() - interval '2 hours'),
  ('a1b2c3d4-0008-4000-8000-000000000008', 'engine_temp', 35, 'celsius', 40.4295, -3.7065, now() - interval '2 hours'),
  ('a1b2c3d4-0008-4000-8000-000000000008', 'fuel_level', 45, 'percent', 40.4295, -3.7065, now() - interval '2 hours'),
  ('a1b2c3d4-0008-4000-8000-000000000008', 'tire_pressure', 34, 'psi', 40.4295, -3.7065, now() - interval '2 hours'),
  ('a1b2c3d4-0008-4000-8000-000000000008', 'battery_voltage', 11.8, 'volts', 40.4295, -3.7065, now() - interval '2 hours'),

  -- Vehicle CP-01 Shield Unit (available)
  ('a1b2c3d4-0009-4000-8000-000000000009', 'speed', 0, 'km/h', 40.4450, -3.6900, now() - interval '6 minutes'),
  ('a1b2c3d4-0009-4000-8000-000000000009', 'engine_temp', 48, 'celsius', 40.4450, -3.6900, now() - interval '6 minutes'),
  ('a1b2c3d4-0009-4000-8000-000000000009', 'fuel_level', 95, 'percent', 40.4450, -3.6900, now() - interval '6 minutes'),
  ('a1b2c3d4-0009-4000-8000-000000000009', 'tire_pressure', 35, 'psi', 40.4450, -3.6900, now() - interval '6 minutes'),
  ('a1b2c3d4-0009-4000-8000-000000000009', 'battery_voltage', 12.9, 'volts', 40.4450, -3.6900, now() - interval '6 minutes'),
  ('a1b2c3d4-0009-4000-8000-000000000009', 'odometer', 15432, 'km', 40.4450, -3.6900, now() - interval '6 minutes'),

  -- Vehicle CP-02 Rescue One (available)
  ('a1b2c3d4-0010-4000-8000-000000000010', 'speed', 0, 'km/h', 40.3890, -3.7050, now() - interval '9 minutes'),
  ('a1b2c3d4-0010-4000-8000-000000000010', 'engine_temp', 44, 'celsius', 40.3890, -3.7050, now() - interval '9 minutes'),
  ('a1b2c3d4-0010-4000-8000-000000000010', 'fuel_level', 78, 'percent', 40.3890, -3.7050, now() - interval '9 minutes'),
  ('a1b2c3d4-0010-4000-8000-000000000010', 'tire_pressure', 34, 'psi', 40.3890, -3.7050, now() - interval '9 minutes'),
  ('a1b2c3d4-0010-4000-8000-000000000010', 'battery_voltage', 12.6, 'volts', 40.3890, -3.7050, now() - interval '9 minutes'),

  -- Vehicle H-01 Multi-Role Alpha (in_service)
  ('a1b2c3d4-0011-4000-8000-000000000011', 'speed', 42, 'km/h', 40.4110, -3.7320, now() - interval '1 minute'),
  ('a1b2c3d4-0011-4000-8000-000000000011', 'engine_temp', 88, 'celsius', 40.4110, -3.7320, now() - interval '1 minute'),
  ('a1b2c3d4-0011-4000-8000-000000000011', 'fuel_level', 62, 'percent', 40.4110, -3.7320, now() - interval '1 minute'),
  ('a1b2c3d4-0011-4000-8000-000000000011', 'tire_pressure', 38, 'psi', 40.4110, -3.7320, now() - interval '1 minute'),
  ('a1b2c3d4-0011-4000-8000-000000000011', 'rpm', 2400, 'rpm', 40.4110, -3.7320, now() - interval '1 minute'),
  ('a1b2c3d4-0011-4000-8000-000000000011', 'oil_pressure', 42, 'psi', 40.4110, -3.7320, now() - interval '1 minute'),
  ('a1b2c3d4-0011-4000-8000-000000000011', 'speed', 55, 'km/h', 40.4100, -3.7300, now() - interval '8 minutes'),
  ('a1b2c3d4-0011-4000-8000-000000000011', 'engine_temp', 90, 'celsius', 40.4100, -3.7300, now() - interval '8 minutes'),

  -- Vehicle H-02 Command Unit (available)
  ('a1b2c3d4-0012-4000-8000-000000000012', 'speed', 0, 'km/h', 40.4198, -3.6980, now() - interval '7 minutes'),
  ('a1b2c3d4-0012-4000-8000-000000000012', 'engine_temp', 50, 'celsius', 40.4198, -3.6980, now() - interval '7 minutes'),
  ('a1b2c3d4-0012-4000-8000-000000000012', 'fuel_level', 70, 'percent', 40.4198, -3.6980, now() - interval '7 minutes'),
  ('a1b2c3d4-0012-4000-8000-000000000012', 'tire_pressure', 33, 'psi', 40.4198, -3.6980, now() - interval '7 minutes'),
  ('a1b2c3d4-0012-4000-8000-000000000012', 'battery_voltage', 13.2, 'volts', 40.4198, -3.6980, now() - interval '7 minutes');


-- ============================================================
-- EVENTS (2-3 per vehicle)
-- ============================================================

INSERT INTO events (vehicle_id, event_type, description, severity, metadata, timestamp) VALUES
  -- P-01
  ('a1b2c3d4-0001-4000-8000-000000000001', 'equipment_check', 'Routine equipment check completed. All items operational.', 'info',
    '{"officer": "Garcia", "items_checked": 5, "issues": 0}', now() - interval '4 hours'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'refuel', 'Vehicle refueled at Central Station.', 'info',
    '{"station": "Central", "liters": 42, "cost_eur": 63.00}', now() - interval '6 hours'),

  -- P-02
  ('a1b2c3d4-0002-4000-8000-000000000002', 'dispatch', 'Dispatched to reported disturbance at Calle Serrano.', 'info',
    '{"incident_id": "INC-2024-1847", "location": "Calle Serrano 45", "priority": "medium"}', now() - interval '30 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'en_route', 'En route to scene. ETA 8 minutes.', 'info',
    '{"eta_minutes": 8, "distance_km": 3.2}', now() - interval '28 minutes'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'maintenance_alert', 'Breathalyzer kit requires calibration.', 'warning',
    '{"equipment": "Breathalyzer Kit", "due_date": "2026-02-12", "type": "calibration"}', now() - interval '48 hours'),

  -- P-03
  ('a1b2c3d4-0003-4000-8000-000000000003', 'completed', 'Traffic control duty completed at Plaza Castilla.', 'info',
    '{"location": "Plaza Castilla", "duration_hours": 3, "incidents_reported": 0}', now() - interval '2 hours'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'refuel', 'Vehicle refueled at North Station.', 'info',
    '{"station": "North", "liters": 28, "cost_eur": 42.00}', now() - interval '3 hours'),

  -- A-01
  ('a1b2c3d4-0004-4000-8000-000000000004', 'completed', 'Patient transport completed. Delivered to Hospital La Paz.', 'info',
    '{"hospital": "Hospital La Paz", "patient_condition": "stable", "response_time_min": 7}', now() - interval '45 minutes'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'equipment_check', 'Post-call equipment check. Restocked supplies.', 'info',
    '{"restocked": ["IV sets", "bandages", "oxygen mask"], "defibrillator_battery": "92%"}', now() - interval '30 minutes'),

  -- A-02
  ('a1b2c3d4-0005-4000-8000-000000000005', 'dispatch', 'Dispatched to cardiac emergency at Gran Via 52.', 'critical',
    '{"incident_type": "cardiac_arrest", "location": "Gran Via 52, 3rd floor", "caller": "bystander", "priority": "critical"}', now() - interval '15 minutes'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'en_route', 'En route with lights and sirens. ETA 5 minutes.', 'warning',
    '{"eta_minutes": 5, "distance_km": 4.1, "sirens_active": true}', now() - interval '14 minutes'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'maintenance_alert', 'Spinal board showing wear. Replacement recommended.', 'warning',
    '{"equipment": "Spinal Board", "condition": "worn", "recommendation": "replace"}', now() - interval '36 hours'),

  -- A-03
  ('a1b2c3d4-0006-4000-8000-000000000006', 'completed', 'Neonatal transport completed successfully to Hospital Gregorio Maranon.', 'info',
    '{"hospital": "Hospital Gregorio Maranon", "patient_type": "neonatal", "response_time_min": 12}', now() - interval '5 hours'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'equipment_check', 'Incubator maintenance check passed.', 'info',
    '{"equipment": "Neonatal Incubator", "temperature_stable": true, "battery": "full"}', now() - interval '3 hours'),

  -- F-01
  ('a1b2c3d4-0007-4000-8000-000000000007', 'completed', 'Kitchen fire extinguished at Calle Alcala 120. No casualties.', 'info',
    '{"incident_type": "kitchen_fire", "location": "Calle Alcala 120", "water_used_liters": 800, "duration_min": 35}', now() - interval '8 hours'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'refuel', 'Vehicle refueled. Water tank topped off.', 'info',
    '{"diesel_liters": 95, "water_liters": 3000, "foam_liters": 200}', now() - interval '6 hours'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'equipment_check', 'Full equipment inspection passed.', 'info',
    '{"scba_pressure_ok": true, "hose_condition": "good", "pump_test": "passed"}', now() - interval '4 hours'),

  -- F-02
  ('a1b2c3d4-0008-4000-8000-000000000008', 'maintenance_alert', 'Aerial ladder hydraulic system requires service. Vehicle taken offline.', 'critical',
    '{"system": "aerial_ladder_hydraulics", "issue": "pressure_loss", "severity": "critical"}', now() - interval '3 days'),
  ('a1b2c3d4-0008-4000-8000-000000000008', 'maintenance_alert', 'Rescue winch motor showing signs of wear.', 'warning',
    '{"system": "rescue_winch", "issue": "motor_wear", "estimated_life_hours": 50}', now() - interval '3 days'),

  -- CP-01
  ('a1b2c3d4-0009-4000-8000-000000000009', 'completed', 'Emergency supply distribution completed in Vallecas district.', 'info',
    '{"operation": "supply_distribution", "district": "Vallecas", "items_distributed": 150, "beneficiaries": 45}', now() - interval '12 hours'),
  ('a1b2c3d4-0009-4000-8000-000000000009', 'equipment_check', 'Satellite phone connection test successful.', 'info',
    '{"equipment": "Iridium Sat Phone", "signal_strength": "strong", "test_call": "passed"}', now() - interval '5 hours'),

  -- CP-02
  ('a1b2c3d4-0010-4000-8000-000000000010', 'completed', 'Flood assessment patrol completed along Manzanares River.', 'info',
    '{"operation": "flood_assessment", "area": "Manzanares River banks", "risk_level": "moderate", "distance_km": 12}', now() - interval '18 hours'),
  ('a1b2c3d4-0010-4000-8000-000000000010', 'refuel', 'Vehicle refueled. Generator fuel topped off.', 'info',
    '{"diesel_liters": 55, "generator_fuel_liters": 15}', now() - interval '10 hours'),

  -- H-01
  ('a1b2c3d4-0011-4000-8000-000000000011', 'dispatch', 'Dispatched for debris clearing on M-30 highway.', 'warning',
    '{"operation": "debris_clearing", "location": "M-30 km 12.4", "obstruction": "fallen_tree", "lanes_affected": 2}', now() - interval '45 minutes'),
  ('a1b2c3d4-0011-4000-8000-000000000011', 'en_route', 'En route to M-30. Heavy traffic expected.', 'info',
    '{"eta_minutes": 18, "distance_km": 7.5, "traffic_level": "heavy"}', now() - interval '43 minutes'),
  ('a1b2c3d4-0011-4000-8000-000000000011', 'arrived', 'Arrived at scene. Setting up crane for debris removal.', 'info',
    '{"arrival_time": "2026-02-11T10:02:00Z", "response_time_min": 22}', now() - interval '20 minutes'),

  -- H-02
  ('a1b2c3d4-0012-4000-8000-000000000012', 'completed', 'Command post setup for multi-agency exercise completed.', 'info',
    '{"operation": "exercise_coordination", "agencies": ["police", "fire", "medical", "civil_protection"], "duration_hours": 4}', now() - interval '24 hours'),
  ('a1b2c3d4-0012-4000-8000-000000000012', 'equipment_check', 'Communications systems test. All channels operational.', 'info',
    '{"channels_tested": 16, "satellite_uplink": "operational", "video_feeds": 4, "all_passed": true}', now() - interval '6 hours');


-- ============================================================
-- ANOMALIES (4 active across fleet)
-- ============================================================

INSERT INTO anomalies (vehicle_id, anomaly_type, metric_type, expected_range, actual_value, severity, status, description, timestamp) VALUES
  -- A-02 Rapid Response: high engine temp while responding to emergency
  (
    'a1b2c3d4-0005-4000-8000-000000000005',
    'threshold_breach',
    'engine_temp',
    '{"min": 70, "max": 95}',
    96,
    'warning',
    'active',
    'Engine temperature slightly above normal operating range during emergency response. Monitor closely.',
    now() - interval '6 minutes'
  ),
  -- F-02 Ladder 3: low battery during maintenance period
  (
    'a1b2c3d4-0008-4000-8000-000000000008',
    'threshold_breach',
    'battery_voltage',
    '{"min": 12.0, "max": 14.5}',
    11.8,
    'warning',
    'active',
    'Battery voltage below normal threshold. Vehicle has been in maintenance bay for extended period without starting.',
    now() - interval '2 hours'
  ),
  -- H-01 Multi-Role Alpha: pattern anomaly in fuel consumption
  (
    'a1b2c3d4-0011-4000-8000-000000000011',
    'pattern_anomaly',
    'fuel_level',
    '{"min": 50, "max": 100}',
    62,
    'info',
    'active',
    'Fuel consumption rate 15% higher than average for current operational profile. May indicate heavy load operations.',
    now() - interval '30 minutes'
  ),
  -- P-02 Bravo Unit: route deviation detected
  (
    'a1b2c3d4-0002-4000-8000-000000000002',
    'route_deviation',
    'speed',
    '{"min": 0, "max": 80}',
    82,
    'info',
    'acknowledged',
    'Vehicle deviated from assigned patrol route. Speed slightly above urban limit. Officer notified.',
    now() - interval '10 minutes'
  );


-- ============================================================
-- SCENARIOS (3 templates)
-- ============================================================

INSERT INTO scenarios (name, description, scenario_type, parameters, is_template, created_by) VALUES
  (
    'Dispatch Comparison',
    'Compare response times for dispatching different vehicle types to a simulated incident in central Madrid. Evaluates optimal vehicle selection based on distance, traffic conditions, and vehicle capabilities.',
    'dispatch_comparison',
    '{
      "incident_location": {"latitude": 40.4200, "longitude": -3.7025},
      "incident_type": "medical",
      "severity": "critical",
      "candidate_vehicle_types": ["ambulance", "police"],
      "traffic_model": "real_time",
      "time_of_day": "peak_hours",
      "evaluation_metrics": ["response_time", "fuel_consumption", "equipment_match"],
      "max_response_time_min": 10,
      "simulation_runs": 100,
      "confidence_level": 0.95
    }',
    true,
    NULL
  ),
  (
    'Fuel Depletion Check',
    'Simulate extended operations to predict when each vehicle will require refueling. Models fuel consumption under various operational tempos and identifies vehicles at risk of running low during peak demand.',
    'resource_depletion',
    '{
      "operation_duration_hours": 8,
      "operational_tempo": "high",
      "fuel_consumption_multiplier": 1.3,
      "critical_fuel_threshold_percent": 15,
      "warning_fuel_threshold_percent": 25,
      "refuel_time_minutes": 12,
      "include_return_to_base": true,
      "base_locations": [
        {"name": "Central Station", "latitude": 40.4168, "longitude": -3.7038},
        {"name": "North Station", "latitude": 40.4450, "longitude": -3.6900},
        {"name": "South Station", "latitude": 40.3890, "longitude": -3.7050}
      ]
    }',
    true,
    NULL
  ),
  (
    'Traffic Impact Analysis',
    'Model the impact of a major traffic incident on emergency response capabilities across the fleet. Simulates road closures, traffic rerouting, and evaluates alternative dispatch strategies.',
    'traffic_impact',
    '{
      "incident_location": {"latitude": 40.4230, "longitude": -3.7100},
      "affected_roads": ["M-30", "A-6 exit ramp", "Paseo de la Castellana"],
      "road_closure_radius_km": 1.5,
      "traffic_delay_factor": 2.5,
      "duration_hours": 3,
      "affected_vehicle_count": 4,
      "alternative_routes": true,
      "evaluate_staging_areas": true,
      "peak_hour_adjustment": true,
      "simulation_runs": 50
    }',
    true,
    NULL
  );


-- ============================================================
-- GEOFENCES (3 zones around Madrid)
-- ============================================================

INSERT INTO geofences (name, description, zone_type, coordinates, color, is_active) VALUES
  (
    'Madrid Centro District',
    'Central Madrid coverage zone encompassing Sol, Gran Via, Retiro, and Lavapies neighborhoods. Primary response area for downtown incidents.',
    'district',
    '{
      "type": "Polygon",
      "coordinates": [[
        [-3.7150, 40.4100],
        [-3.6850, 40.4100],
        [-3.6850, 40.4280],
        [-3.7150, 40.4280],
        [-3.7150, 40.4100]
      ]]
    }',
    '#3b82f6',
    true
  ),
  (
    'Estadio Santiago Bernabeu Zone',
    'High-risk event zone around Santiago Bernabeu stadium. Activated during match days and large events requiring enhanced emergency coverage.',
    'high_risk',
    '{
      "type": "Polygon",
      "coordinates": [[
        [-3.6920, 40.4510],
        [-3.6860, 40.4510],
        [-3.6860, 40.4560],
        [-3.6920, 40.4560],
        [-3.6920, 40.4510]
      ]]
    }',
    '#ef4444',
    true
  ),
  (
    'Barajas Airport Restricted',
    'Restricted operational zone around Madrid-Barajas Airport. Special protocols required for emergency vehicle operations within airport perimeter.',
    'restricted',
    '{
      "type": "Polygon",
      "coordinates": [[
        [-3.5800, 40.4650],
        [-3.5400, 40.4650],
        [-3.5400, 40.4950],
        [-3.5800, 40.4950],
        [-3.5800, 40.4650]
      ]]
    }',
    '#f59e0b',
    false
  );


-- ============================================================
-- INCIDENTS (2 active)
-- ============================================================

INSERT INTO incidents (title, description, incident_type, severity, latitude, longitude, status, assigned_vehicle_ids, reported_at) VALUES
  (
    'Cardiac Emergency - Gran Via',
    'Reported cardiac arrest at commercial building on Gran Via 52, 3rd floor. Bystander performing CPR. Ambulance dispatched.',
    'medical',
    'critical',
    40.4200,
    -3.7025,
    'dispatched',
    ARRAY['a1b2c3d4-0005-4000-8000-000000000005'::UUID],
    now() - interval '16 minutes'
  ),
  (
    'Road Debris - M-30 Highway',
    'Fallen tree blocking two lanes on M-30 highway at km 12.4. Traffic backing up. Multi-role vehicle dispatched for clearing operations.',
    'accident',
    'warning',
    40.4110,
    -3.7320,
    'in_progress',
    ARRAY['a1b2c3d4-0011-4000-8000-000000000011'::UUID, 'a1b2c3d4-0002-4000-8000-000000000002'::UUID],
    now() - interval '50 minutes'
  );


-- ============================================================
-- INSIGHTS / RECOMMENDATIONS (5 entries)
-- ============================================================

INSERT INTO insights (insight_type, title, description, severity, vehicle_id, metadata, is_dismissed) VALUES
  (
    'maintenance_due',
    'Ladder 3 Overdue for Hydraulic Service',
    'Fire truck F-02 (Ladder 3) aerial ladder hydraulic system has exceeded the recommended service interval by 120 hours. Immediate maintenance is critical to ensure operational readiness. Vehicle is currently offline.',
    'critical',
    'a1b2c3d4-0008-4000-8000-000000000008',
    '{"overdue_hours": 120, "last_service": "2025-11-15", "recommended_interval_hours": 500, "current_hours": 620, "estimated_repair_cost_eur": 3200}',
    false
  ),
  (
    'response_time_trend',
    'Ambulance Response Times Improving',
    'Average ambulance response time has decreased by 12% over the past 7 days, from 8.4 minutes to 7.4 minutes. This correlates with the new GPS-based dispatch routing implemented last week.',
    'info',
    NULL,
    '{"period_days": 7, "previous_avg_min": 8.4, "current_avg_min": 7.4, "improvement_percent": 12, "sample_size": 47, "contributing_factor": "gps_dispatch_routing"}',
    false
  ),
  (
    'fuel_efficiency',
    'Multi-Role Alpha High Fuel Consumption',
    'Vehicle H-01 (Multi-Role Alpha) fuel consumption is 15% above fleet average for its operational profile. This may be due to heavy load operations or potential engine tuning needed.',
    'warning',
    'a1b2c3d4-0011-4000-8000-000000000011',
    '{"consumption_l_per_100km": 38.5, "fleet_avg_l_per_100km": 33.5, "deviation_percent": 15, "period_days": 14, "possible_causes": ["heavy_load", "engine_tuning", "terrain"]}',
    false
  ),
  (
    'utilization_alert',
    'Police Fleet Utilization Below Target',
    'Police vehicle utilization has dropped to 62% over the past week, below the 75% operational target. Consider reassigning patrol routes or reducing fleet size for cost optimization.',
    'info',
    NULL,
    '{"current_utilization_percent": 62, "target_utilization_percent": 75, "period_days": 7, "active_vehicles": 3, "avg_hours_per_day": 14.9, "recommendation": "reassign_patrol_routes"}',
    false
  ),
  (
    'anomaly_spike',
    'Increased Engine Temperature Alerts This Week',
    'Engine temperature anomalies have increased 40% this week across the ambulance fleet. Two vehicles (A-02, A-03) recorded temperatures above 95C during emergency responses. Recommend cooling system inspections.',
    'warning',
    NULL,
    '{"anomaly_count_this_week": 7, "anomaly_count_last_week": 5, "increase_percent": 40, "affected_vehicles": ["a1b2c3d4-0005-4000-8000-000000000005", "a1b2c3d4-0006-4000-8000-000000000006"], "recommendation": "cooling_system_inspection"}',
    false
  );


-- ============================================================
-- MAINTENANCE RECORDS
-- ============================================================

INSERT INTO maintenance_records (vehicle_id, maintenance_type, description, status, scheduled_date, completed_date, cost, notes) VALUES
  (
    'a1b2c3d4-0008-4000-8000-000000000008',
    'emergency',
    'Aerial ladder hydraulic system pressure loss. Full hydraulic system overhaul required.',
    'in_progress',
    '2026-02-10',
    NULL,
    3200.00,
    'Parts ordered from MAN dealer. Estimated completion 2-3 days. Winch motor also being inspected.'
  ),
  (
    'a1b2c3d4-0001-4000-8000-000000000001',
    'scheduled',
    'Routine 35,000 km service. Oil change, brake inspection, tire rotation.',
    'scheduled',
    '2026-02-15',
    NULL,
    450.00,
    'Scheduled at BMW authorized service center.'
  ),
  (
    'a1b2c3d4-0004-4000-8000-000000000004',
    'inspection',
    'Annual medical equipment certification inspection.',
    'scheduled',
    '2026-02-20',
    NULL,
    NULL,
    'Required for ALS certification renewal. Defibrillator and ventilator must pass calibration tests.'
  ),
  (
    'a1b2c3d4-0007-4000-8000-000000000007',
    'scheduled',
    'Quarterly pump system test and hose inspection.',
    'completed',
    '2026-02-08',
    '2026-02-08',
    280.00,
    'All tests passed. Pump operating at rated capacity. Hoses in good condition.'
  );

# ============================================================
# ML Microservice — Digital Twin Emergency Vehicles
# FastAPI + TensorFlow + scikit-learn
# ============================================================

import os
import pickle
import numpy as np
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from tensorflow.keras.models import load_model
import tensorflow as tf

# ── Configuración ─────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = MODEL_PATH = os.getenv('MODEL_PATH', os.path.join(BASE_DIR, 'modelo_extraido'))
SCALER_PATH = os.getenv('SCALER_PATH', os.path.join(BASE_DIR, 'scaler_finetuned.pkl'))

MAINT_METRICS = ['engine_temp', 'oil_pressure', 'fuel_level', 'battery_voltage', 'tire_pressure']
LOOKBACK      = 40

model = load_model(os.path.join(BASE_DIR, 'modelo_extraido'))
scaler = None

# ── Lifespan (carga modelo al iniciar, no al importar) ────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, scaler

    print(f'📦 Cargando modelo: {MODEL_PATH}')
    model = load_model(MODEL_PATH)
    print('✅ Modelo cargado')

    print(f'📦 Cargando scaler: {SCALER_PATH}')
    with open(SCALER_PATH, 'rb') as f:
        scaler = pickle.load(f)
    print('✅ Scaler cargado')

    yield  # La app corre aquí

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title='Digital Twin ML Service',
    description='LSTM Predictive Maintenance para vehículos de emergencia',
    version='1.0.0',
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)
# ── Schemas ───────────────────────────────────────────────────

class TelemetryPoint(BaseModel):
    engine_temp:     float
    oil_pressure:    float
    fuel_level:      float
    battery_voltage: float
    tire_pressure:   float

class PredictRequest(BaseModel):
    vehicle_id:       str
    # ventana de 40 lecturas — lista de objetos con las 5 métricas
    telemetry_window: list[TelemetryPoint]

class PredictResponse(BaseModel):
    vehicle_id:          str
    failure_probability: float
    risk_level:          str
    severity:            str
    recommendation:      str
    metrics_analyzed:    int
    confidence_note:     str
    evaluated_at:        str
    source:              str = 'ml_service'

# ── Helpers ───────────────────────────────────────────────────

def classify_risk(probability: float) -> dict:
    if probability > 0.7:
        return {
            'risk_level':     'CRITICAL',
            'severity':       'critical',
            'recommendation': 'Immediate maintenance recommended — do not dispatch',
        }
    if probability > 0.3:
        return {
            'risk_level':     'WARNING',
            'severity':       'warning',
            'recommendation': 'Monitor in the coming hours — schedule maintenance',
        }
    return {
        'risk_level':     'NORMAL',
        'severity':       'info',
        'recommendation': 'Normal operation',
    }

# ── Endpoints ─────────────────────────────────────────────────

@app.get('/health')
def health():
    return {
        'status':      'ok',
        'model':       MODEL_PATH,
        'scaler':      SCALER_PATH,
        'lookback':    LOOKBACK,
        'metrics':     MAINT_METRICS,
        'timestamp':   datetime.now(timezone.utc).isoformat(),
    }

@app.get('/model/info')
def model_info():
    layers = [
        {'name': l.name, 'trainable': l.trainable}
        for l in model.layers
    ]
    return {
        'model_path':    MODEL_PATH,
        'input_shape':   [LOOKBACK, len(MAINT_METRICS)],
        'metrics':       MAINT_METRICS,
        'scaler_ranges': {
            m: {
                'min': float(scaler.data_min_[i]),
                'max': float(scaler.data_max_[i])
            }
            for i, m in enumerate(MAINT_METRICS)
        },
        'layers': layers,
    }

@app.post('/predict', response_model=PredictResponse)
def predict(request: PredictRequest):
    # Validar longitud de ventana
    if len(request.telemetry_window) != LOOKBACK:
        raise HTTPException(
            status_code=422,
            detail=f'telemetry_window debe tener exactamente {LOOKBACK} puntos, recibidos: {len(request.telemetry_window)}'
        )

    # Construir matriz [40 × 5]
    matrix = np.array([
        [
            point.engine_temp,
            point.oil_pressure,
            point.fuel_level,
            point.battery_voltage,
            point.tire_pressure,
        ]
        for point in request.telemetry_window
    ])  # shape: (40, 5)

    # Normalizar con scaler
    scaled = scaler.transform(matrix)  # shape: (40, 5)

    # Verificar NaN post-transform
    if np.isnan(scaled).any():
        raise HTTPException(
            status_code=422,
            detail='Los datos contienen valores fuera de rango que producen NaN al normalizar'
        )

    # Reshape para LSTM: (1, 40, 5)
    X = scaled.reshape(1, LOOKBACK, len(MAINT_METRICS))

    # Predicción
    proba = float(model.predict(X, verbose=0)[0][0])
    proba = round(max(0.0, min(1.0, proba)), 4)

    classification = classify_risk(proba)

    return PredictResponse(
        vehicle_id=          request.vehicle_id,
        failure_probability= proba,
        risk_level=          classification['risk_level'],
        severity=            classification['severity'],
        recommendation=      classification['recommendation'],
        metrics_analyzed=    LOOKBACK,
        confidence_note='LSTM model trained on synthetic data — use as a supporting signal only', 
       evaluated_at=        datetime.now(timezone.utc).isoformat(),
    )
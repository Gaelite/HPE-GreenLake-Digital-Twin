# Digital Twin — Vehículos de Emergencia

POC de un gemelo digital para flotas de emergencia. Un motor de simulación genera telemetría continua cada 5 segundos, ejecuta pathfinding A\* sobre un grafo de calles de Madrid y gestiona el ciclo de vida completo de incidentes. Un modelo LSTM predice fallas mecánicas por vehículo y penaliza el motor de despacho según el nivel de riesgo. Todo fluye en vivo al dashboard vía Supabase Realtime.

🔗 **Demo:** [emergency-vehicles.xyz/dashboard](https://emergency-vehicles.xyz/dashboard)

---

## Getting Started

Este proyecto está construido con [Next.js](https://nextjs.org) usando [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Corre el servidor de desarrollo:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## Arquitectura

```
Frontend (Next.js)
    └── Supabase (PostgreSQL + Realtime)
            └── Motor de Simulación (Node.js)
                    └── Microservicio IA (FastAPI · puerto 8001)
```

Cada tick (5 s) ejecuta 4 fases:
```
executeTick()
  ├── 1. Telemetría + Movimiento de Vehículos
  ├── 2. Ciclo de Vida de Incidentes (crear → despachar → llegar → resolver)
  ├── 3. Detección de Anomalías
  └── 4. Generación de Insights (cada 12 ticks)
```

---

## Features

- **Simulación en tiempo real** — telemetría de 9 variables por vehículo cada 5 s
- **Pathfinding A\*** — grafo de ~130 nodos sobre calles reales de Madrid, densificado a >200 nodos para interpolación GPS suave
- **Despacho inteligente** — asigna el vehículo más cercano por distancia vial (Dijkstra) con afinidad por tipo de emergencia
- **Detección de anomalías** — motor de reglas con umbrales configurables y severidades: informacional / advertencia / crítico
- **Mantenimiento predictivo (LSTM)** — modelo entrenado con 150k+ lecturas, AUC-ROC 0.75–0.80, inferencia <100 ms por vehículo
- **Rutas dinámicas** — visualización vía TomTom/OSRM con recalculo automático al aparecer obstáculos
- **Dashboard interactivo** — mapa en vivo, gráficas de telemetría, alertas e insights operacionales

---

## Modelo LSTM

| Parámetro | Valor |
|-----------|-------|
| Input | 40 timesteps × 5 métricas |
| Arquitectura | LSTM(64) → Dropout → LSTM(32) → Dropout → Dense(16) → Dense(1) |
| Entrenamiento | 15 vehículos · 168 h · ~150,600 filas |
| AUC-ROC validación | 0.75 – 0.80 |
| Inferencia | < 100 ms por vehículo |

Métricas de entrada: `engine_temp · oil_pressure · fuel_level · battery_voltage · tire_pressure`

| Probabilidad | Nivel | Acción |
|---|---|---|
| P > 0.70 | 🔴 CRÍTICO | Mantenimiento inmediato |
| 0.30 < P ≤ 0.70 | 🟡 ADVERTENCIA | Monitorear |
| P ≤ 0.30 | 🟢 NORMAL | Sin acción |

---

## Ramas

| Rama | Descripción |
|------|-------------|
| `main` | Frontend Next.js + motor de simulación |
| `AI-Python-backend` | Microservicio FastAPI, modelo LSTM, scaler y pipeline de entrenamiento |

---

## Stack

**Frontend:** Next.js · React · TailwindCSS · Recharts · Leaflet  
**Simulación:** Node.js · TypeScript  
**IA:** Python · FastAPI · TensorFlow/Keras · scikit-learn  
**Base de datos:** Supabase (PostgreSQL + Realtime)  
**Mapas:** TomTom Routing API · OSRM  
**Despliegue:** Vercel

---

*Made with love by mazapan de nuez*

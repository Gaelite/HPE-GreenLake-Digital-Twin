#!/bin/bash

echo "======================================"
echo "Starting Digital Twin Platform"
echo "======================================"

echo ""
echo "[1/4] Installing frontend dependencies..."
npm install

echo ""
echo "[2/4] Starting Next.js frontend..."
npm run dev &

echo ""
echo "[3/4] Starting Python AI microservice..."
cd ai-microservice || exit
uvicorn main:app --reload &

echo ""
echo "[4/4] Starting telemetry simulation..."
cd ..
npm run simulator:start

echo ""
echo "======================================"
echo "All services initialized"
echo "======================================"
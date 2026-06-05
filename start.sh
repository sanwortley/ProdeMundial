#!/usr/bin/env bash
set -e

echo "Installing backend dependencies..."
cd /app/backend
pip install -r requirements.txt

echo "Building frontend..."
cd /app/frontend
npm ci && npm run build

echo "Starting server..."
cd /app/backend
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

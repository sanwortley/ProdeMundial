#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing backend dependencies..."
cd "$ROOT_DIR/backend"
pip install -r requirements.txt

echo "Building frontend..."
cd "$ROOT_DIR/frontend"
npm ci && npm run build

echo "Starting server..."
cd "$ROOT_DIR/backend"
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

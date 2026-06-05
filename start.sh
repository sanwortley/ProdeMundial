#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing backend dependencies..."
python3 -m venv "$ROOT_DIR/venv"
. "$ROOT_DIR/venv/bin/activate"
cd "$ROOT_DIR/backend"
pip3 install -r requirements.txt

echo "Installing Node.js..."
apt-get update -qq && apt-get install -y -qq nodejs npm

echo "Building frontend..."
cd "$ROOT_DIR/frontend"
npm ci && npm run build

echo "Starting server..."
. "$ROOT_DIR/venv/bin/activate"
cd "$ROOT_DIR/backend"
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
